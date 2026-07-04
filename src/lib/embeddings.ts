import { pipeline, env } from "@xenova/transformers";
import { CONFIG } from "./config";

// --- VERCEL CRASH ÇÖZÜMÜ (WASM FORCING) ---
// Native (.so) binary aramayı kapat, tamamen WebAssembly (WASM) motoruna zorla
env.allowLocalModels = false;

// TypeScript'in kızmasını engellemek için any üzerinden güvenli atama yapıyoruz
const backends = (env as any).backends || {};
backends.onnx = backends.onnx || {};
backends.onnx.wasm = backends.onnx.wasm || {};
backends.onnx.wasm.numThreads = 1;
backends.onnx.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";

(env as any).backends = backends;
// ------------------------------------------

type Extractor = (
  input: string,
  options?: Record<string, unknown>,
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<Extractor> | null = null;

export async function embedQuery(text: string) {
  const extractor = await getExtractor();
  const output = await extractor(`query: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data, Number);
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      CONFIG.embeddingModel,
    ) as Promise<Extractor>;
  }
  return extractorPromise;
}
