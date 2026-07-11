import vectorstore from "../../../src/data/vectorstore.json";
import { CONFIG } from "../../../src/lib/config";
import { providerStatus } from "../../../src/lib/llm";
import { databaseReady } from "../../../src/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dbReady = await databaseReady();
  const provider = providerStatus();
  return Response.json({
    vectorstore: true,
    embedding_model: CONFIG.embeddingModel,
    database: dbReady,
    chunks: vectorstore.chunks.length,
    ...provider,
    status: provider.status === "ok" && dbReady ? "ok" : "degraded",
  });
}
