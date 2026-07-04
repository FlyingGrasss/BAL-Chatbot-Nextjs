import { getIdentity, saveSuggestion, checkSuggestionQuota, incrementSuggestionUsage } from "../../../src/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return Response.json({ error: "İçerik alanı gerekli" }, { status: 400 });
  }

  if (content.length > 2000) {
    return Response.json({ error: "Öneri çok uzun (en fazla 2000 karakter)" }, { status: 400 });
  }

  const identity = await getIdentity(request.headers);
  if (!identity) {
    return Response.json({ error: "Ziyaretçi kimliği alınamadı" }, { status: 401 });
  }

  const quota = await checkSuggestionQuota(identity);
  if (!quota.ok) {
    return Response.json({ error: quota.error }, { status: 429 });
  }

  await saveSuggestion(identity, content);
  await incrementSuggestionUsage(identity);

  return Response.json({ ok: true });
}
