import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = path.join(ROOT, "src", "data", "RAG_Dataset_BAL.md");
const OUTPUT_PATH = path.join(ROOT, "src", "data", "vectorstore.json");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "intfloat/multilingual-e5-small";
const HF_TOKEN = process.env.HF_TOKEN || "";
const MAX_CHARS = Number(process.env.INDEX_CHUNK_MAX_CHARS || 1200);
const MIN_CHARS = Number(process.env.INDEX_CHUNK_MIN_CHARS || 180);
const BATCH_SIZE = Number(process.env.INDEX_EMBED_BATCH_SIZE || 8);
const MAX_RETRIES = 4;
const DRY_RUN = process.argv.includes("--dry-run");

const markdown = await readFile(SOURCE_PATH, "utf8");
const sourceSha256 = createHash("sha256").update(markdown).digest("hex");
const chunks = buildChunks(markdown);

console.log(
  `Source: ${path.relative(ROOT, SOURCE_PATH)} (${markdown.length.toLocaleString("en-US")} chars)`,
);
console.log(`Chunks: ${chunks.length} (${MIN_CHARS}-${MAX_CHARS} target chars)`);

if (DRY_RUN) {
  printStats(chunks);
  process.exit(0);
}

if (!HF_TOKEN) {
  throw new Error("HF_TOKEN is required to build embeddings. Add it to .env.local.");
}

const embeddedChunks = [];
let embeddingDim = 0;

for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
  const batch = chunks.slice(offset, offset + BATCH_SIZE);
  const vectors = await embedBatch(
    batch.map((chunk) => `passage: ${chunk.breadcrumb}\n${chunk.text}`),
  );

  if (vectors.length !== batch.length) {
    throw new Error(`Embedding count mismatch at chunk ${offset}: ${vectors.length}/${batch.length}`);
  }

  for (let index = 0; index < batch.length; index += 1) {
    const embedding = normalize(vectors[index]);
    embeddingDim ||= embedding.length;
    if (embedding.length !== embeddingDim) {
      throw new Error(`Embedding dimension mismatch at chunk ${offset + index}`);
    }
    embeddedChunks.push({
      ...batch[index],
      embedding: embedding.map((value) => Number(value.toFixed(7))),
    });
  }

  console.log(`Embedded ${Math.min(offset + batch.length, chunks.length)}/${chunks.length}`);
}

const payload = {
  schema_version: 1,
  source_file: "src/data/RAG_Dataset_BAL.md",
  source_sha256: sourceSha256,
  embedding_model: EMBEDDING_MODEL,
  embedding_dim: embeddingDim,
  chunking: {
    strategy: "markdown-headings-and-paragraphs-v1",
    min_chars: MIN_CHARS,
    max_chars: MAX_CHARS,
  },
  chunks: embeddedChunks,
};

await writeFile(TEMP_PATH, JSON.stringify(payload), "utf8");
await rename(TEMP_PATH, OUTPUT_PATH);

console.log(
  `Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${embeddedChunks.length} chunks x ${embeddingDim} dims)`,
);

function buildChunks(source) {
  const sections = parseSections(source);
  const output = [];

  for (const section of sections) {
    const sectionChunks = chunkText(section.body, MAX_CHARS, MIN_CHARS);
    sectionChunks.forEach((text, index) => {
      output.push({
        id: output.length,
        text,
        section_title: section.title,
        breadcrumb: section.breadcrumb,
        section_level: section.level,
        chunk_index_in_section: index,
        total_chunks_in_section: sectionChunks.length,
        char_count: text.length,
        word_count: text.split(/\s+/u).filter(Boolean).length,
      });
    });
  }

  return output;
}

function parseSections(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const headingStack = [];
  const sections = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const body = current.lines
      .join("\n")
      .replace(/^\s*---\s*$/gmu, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (body) sections.push({ ...current, body });
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/u);
    if (!heading) {
      if (current) current.lines.push(line);
      continue;
    }

    flush();
    const level = heading[1].length;
    const title = heading[2].trim();
    headingStack[level - 1] = title;
    headingStack.length = level;
    current = {
      title,
      level,
      breadcrumb: headingStack.filter(Boolean).join(" > "),
      lines: [],
    };
  }

  flush();
  return sections;
}

function chunkText(text, maxChars, minChars) {
  const blocks = text
    .split(/\n{2,}/u)
    .flatMap((block) => splitOversizedBlock(block.trim(), maxChars))
    .filter(Boolean);
  const chunks = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = block;
  }
  if (current) chunks.push(current);

  if (
    chunks.length > 1 &&
    chunks.at(-1).length < minChars &&
    chunks.at(-1).length + chunks.at(-2).length + 2 <= maxChars
  ) {
    const tail = chunks.pop();
    const previous = chunks.pop();
    chunks.push(`${previous}\n\n${tail}`);
  }

  return chunks;
}

function splitOversizedBlock(block, maxChars) {
  if (block.length <= maxChars) return [block];

  const lines = block.split("\n");
  if (lines.length > 1) return packUnits(lines, maxChars, "\n");

  const sentences = block.match(/[^.!?]+(?:[.!?]+|$)/gu) || [block];
  const units = sentences.flatMap((sentence) => splitWords(sentence.trim(), maxChars));
  return packUnits(units, maxChars, " ");
}

function splitWords(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const output = [];
  let current = "";
  for (const word of text.split(/\s+/u)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current) output.push(current);
      current = word;
    }
  }
  if (current) output.push(current);
  return output;
}

function packUnits(units, maxChars, separator) {
  const output = [];
  let current = "";
  for (const unit of units.filter(Boolean)) {
    const candidate = current ? `${current}${separator}${unit}` : unit;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current) output.push(current);
      current = unit;
    }
  }
  if (current) output.push(current);
  return output;
}

async function embedBatch(inputs) {
  const url = `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}/pipeline/feature-extraction`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs }),
    });

    if (response.ok) {
      const result = await response.json();
      if (
        !Array.isArray(result) ||
        result.length !== inputs.length ||
        !result.every((vector) => Array.isArray(vector) && vector.every(Number.isFinite))
      ) {
        throw new Error("Hugging Face returned an unexpected embedding shape.");
      }
      return result;
    }

    const body = await response.text().catch(() => "");
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      throw new Error(`Hugging Face HTTP ${response.status}: ${body.slice(0, 240)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
  }

  throw new Error("Embedding retries exhausted.");
}

function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Cannot normalize an empty embedding vector.");
  }
  return vector.map((value) => value / magnitude);
}

function printStats(items) {
  const lengths = items.map((item) => item.char_count);
  const words = items.reduce((sum, item) => sum + item.word_count, 0);
  console.log(
    JSON.stringify(
      {
        source_sha256: sourceSha256,
        chunks: items.length,
        words,
        min_chars: Math.min(...lengths),
        max_chars: Math.max(...lengths),
        average_chars: Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length),
      },
      null,
      2,
    ),
  );
}
