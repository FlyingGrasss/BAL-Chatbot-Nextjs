import { pipeline } from "@xenova/transformers";
import { CONFIG } from "./config";

type Extractor = (input: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<Extractor> | null = null;

export async function embedQuery(text: string) {
  const extractor = await getExtractor();
  const output = await extractor(`query: ${text}`, { pooling: "mean", normalize: true });
  return Array.from(output.data, Number);
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", CONFIG.embeddingModel) as Promise<Extractor>;
  }
  return extractorPromise;
}
