import { getIdentity, saveFeedback } from "../../../../src/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const questionIndex = Number(body?.question_index);
  if (!Number.isFinite(questionIndex) || questionIndex <= 0) {
    return Response.json({ error: "question_index gerekli" }, { status: 400 });
  }

  const identity = await getIdentity(request.headers);
  if (!identity) return Response.json({ error: "Kimlik alınamadı" }, { status: 401 });

  const feedback = typeof body?.feedback === "string" ? body.feedback : undefined;
  const feedbackText = typeof body?.feedback_text === "string" ? body.feedback_text.trim() : undefined;

  if (feedback && feedback !== "like" && feedback !== "dislike") {
    return Response.json({ error: "feedback sadece 'like' veya 'dislike' olabilir" }, { status: 400 });
  }

  const ok = await saveFeedback(identity, questionIndex, feedback, feedbackText);
  if (!ok) return Response.json({ error: "Soru bulunamadı" }, { status: 404 });
  return Response.json({ ok: true });
}
