import { CONFIG } from "../../../src/lib/config";
import { buildAugmentedUserMessage, buildSourcesPayload, formatContext, retrieve } from "../../../src/lib/rag";
import { sse, streamResponse } from "../../../src/lib/sse";
import {
  appendTurn,
  decrementActiveRequests,
  getRecentHistory,
  incrementActiveRequests,
} from "../../../src/lib/sessions";
import { checkQuota, getIdentity, incrementUsage, saveChatLog } from "../../../src/lib/storage";
import { streamChat } from "../../../src/lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body?.session_id === "string" ? body.session_id : "default";

  if (!userMessage) {
    return Response.json({ error: "message alanı gerekli", error_type: "technical" }, { status: 400 });
  }

  const identity = await getIdentity(request.headers);
  if (!identity) {
    return Response.json(
      { error: "Ziyaretçi kimliği alınamadı; lütfen sayfayı yenileyin.", error_type: "technical" },
      { status: 401 },
    );
  }

  const quota = await checkQuota(identity);
  if (!quota.ok) {
    return Response.json({ error: quota.error, error_type: "quota" }, { status: 429 });
  }

  const updatedQuota = await incrementUsage(identity);

  let retrieved;
  try {
    retrieved = await retrieve(userMessage, CONFIG.retrievalTopK);
  } catch {
    return Response.json(
      { error: "Şu anda çok yoğumuz. Lütfen biraz sonra tekrar dene.", error_type: "retry" },
      { status: 503 },
    );
  }

  const context = formatContext(retrieved, CONFIG.retrievalScoreThreshold);
  const augmentedMessage = buildAugmentedUserMessage(userMessage, context);
  const recentHistory = getRecentHistory(sessionId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullResponse = "";
      let hadError = false;
      let savedQuestionIndex: number | null = null;
      const active = incrementActiveRequests();

      try {
        if (active >= CONFIG.congestionThreshold) {
          controller.enqueue(encoder.encode(sse({ congestion: true, active_requests: active })));
        }

        for await (const event of streamChat(recentHistory, augmentedMessage)) {
          if ("__full_response__" in event) {
            fullResponse = event.__full_response__;
            continue;
          }
          if ("error" in event) hadError = true;
          controller.enqueue(encoder.encode(sse(event)));
        }
      } catch {
        hadError = true;
        controller.enqueue(encoder.encode(sse({ error: "Teknik bir sorun oluştu.", error_type: "technical" })));
      } finally {
        decrementActiveRequests();
      }

      if (fullResponse && !hadError) {
        appendTurn(sessionId, userMessage, fullResponse);
        try {
          savedQuestionIndex = await saveChatLog(identity, userMessage, fullResponse);
        } catch {
          savedQuestionIndex = null;
        }
      }

      const donePayload: Record<string, unknown> = {
        done: true,
        sources: buildSourcesPayload(retrieved, CONFIG.retrievalScoreThreshold),
        near_limit: updatedQuota.daily_used >= 30,
      };
      if (savedQuestionIndex) donePayload.question_index = savedQuestionIndex;
      controller.enqueue(encoder.encode(sse(donePayload)));
      controller.close();
    },
  });

  return streamResponse(stream);
}
