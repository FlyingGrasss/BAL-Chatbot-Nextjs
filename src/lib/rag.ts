import vectorstore from "../data/vectorstore.json";
import { CONFIG } from "./config";
import { embedQuery } from "./embeddings";
import type { RetrievedChunk } from "./types";

type VectorChunk = {
  id: number;
  text: string;
  breadcrumb?: string;
  section_title?: string;
  embedding: number[];
};

const chunks = vectorstore.chunks as VectorChunk[];

export async function retrieve(query: string, topK = CONFIG.retrievalTopK): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  return chunks
    .map((chunk) => ({
      ...chunk,
      relevance_score: dot(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, topK)
    .map(({ embedding: _embedding, ...chunk }) => chunk);
}

export function formatContext(retrieved: RetrievedChunk[], threshold = CONFIG.retrievalScoreThreshold) {
  if (!retrieved.length) return "Bağlamda ilgili bilgi bulunamadı.";

  const parts = retrieved
    .filter((chunk) => chunk.relevance_score >= threshold)
    .map((chunk) => `[Kaynak: ${chunk.breadcrumb || ""}]\n${chunk.text}`);

  return parts.length ? parts.join("\n\n---\n\n") : "Bağlamda yeterince ilgili bilgi bulunamadı.";
}

export function buildAugmentedUserMessage(userInput: string, context: string) {
  return `## İlgili Bağlam (Okul Bilgi Kaynağı)\n\n${context}\n\n---\n\n## Kullanıcı Sorusu\n\n${userInput}`;
}

export function buildSourcesPayload(retrieved: RetrievedChunk[], threshold = CONFIG.retrievalScoreThreshold) {
  return retrieved
    .slice(0, 3)
    .filter((chunk) => chunk.relevance_score >= threshold)
    .map((chunk) => ({
      breadcrumb: chunk.breadcrumb || "",
      score: Math.round(chunk.relevance_score * 1000) / 1000,
    }));
}

function dot(a: number[], b: number[]) {
  let score = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) score += a[i] * b[i];
  return score;
}
