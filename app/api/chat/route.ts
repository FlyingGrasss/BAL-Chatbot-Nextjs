import { CONFIG } from "../../../src/lib/config";
import { DEFAULT_QUESTIONS } from "../../../src/lib/defaultQuestions";
import {
  buildAugmentedUserMessage,
  buildRetrievalQuery,
  buildSourcesPayload,
  formatContext,
  isBalRelatedQuery,
  retrieve,
  shouldUseGoogleSearch,
} from "../../../src/lib/rag";
import { sse, streamResponse } from "../../../src/lib/sse";
import {
  appendTurn,
  decrementActiveRequests,
  getRecentHistory,
  incrementActiveRequests,
} from "../../../src/lib/sessions";
import {
  checkQuota,
  checkIpQuota,
  getCachedChatResponse,
  getIdentity,
  incrementIpUsage,
  incrementUsage,
  quotaSnapshot,
  saveCachedChatResponse,
  saveChatLog,
} from "../../../src/lib/storage";
import { streamChat } from "../../../src/lib/llm";
import { estimateMessageTokens, estimateTokens } from "../../../src/lib/tokenCounter";
import type { ChatMessage } from "../../../src/lib/types";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Token limits
const MAX_MESSAGE_TOKENS = 500; // Max tokens per user message
const MAX_TOTAL_REQUEST_TOKENS = 100000; // Message + RAG context + conversation history
const DEFAULT_CACHE_VERSION = "2";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userMessage =
    typeof body?.message === "string" ? body.message.trim() : "";
  const sessionId =
    typeof body?.session_id === "string" ? body.session_id : "default";

  if (!userMessage) {
    return Response.json(
      { error: "message alanı gerekli", error_type: "technical" },
      { status: 400 },
    );
  }

  // ============ NEW: Quick token check on message alone ============
  const messageTokens = estimateTokens(userMessage);
  if (messageTokens > MAX_MESSAGE_TOKENS) {
    return Response.json(
      {
        error: `Mesaj çok uzun (${messageTokens} tokens, maksimum ${MAX_MESSAGE_TOKENS}). Lütfen sorunuzu kısaltın.`,
        error_type: "quota",
      },
      { status: 429 },
    );
  }
  // ===================================================================

  const identity = await getIdentity(request.headers);
  if (!identity) {
    return Response.json(
      {
        error: "Ziyaretçi kimliği alınamadı; lütfen sayfayı yenileyin.",
        error_type: "technical",
      },
      { status: 401 },
    );
  }

  const ipQuota = await checkIpQuota(request.headers);
  if (!ipQuota.ok) {
    return Response.json(
      { error: ipQuota.error, error_type: "quota" },
      { status: 429 },
    );
  }

  await incrementIpUsage(request.headers);

  const cacheKey = DEFAULT_QUESTIONS.has(userMessage)
    ? createHash("sha256")
        .update(`${DEFAULT_CACHE_VERSION}:${userMessage}`)
        .digest("hex")
    : null;

  if (cacheKey) {
    try {
      const cached = await getCachedChatResponse(cacheKey);
      if (cached) {
        const currentQuota = await quotaSnapshot(identity);
        appendTurn(sessionId, userMessage, cached.answer);
        let questionIndex: number | null = null;
        try {
          questionIndex = await saveChatLog(identity, userMessage, cached.answer);
        } catch {
          questionIndex = null;
        }
        return streamResponse(
          cachedStream(
            cached.answer,
            cached.sources,
            questionIndex || undefined,
            currentQuota.daily_remaining <= 10,
          ),
        );
      }
    } catch (error) {
      console.warn("[CACHE READ ERROR]", error instanceof Error ? error.message : error);
    }
  }

  const quota = await checkQuota(identity);
  if (!quota.ok) {
    return Response.json(
      { error: quota.error, error_type: "quota" },
      { status: 429 },
    );
  }

  const updatedQuota = await incrementUsage(identity);

  const clientHistory = parseClientHistory(body?.history);
  const recentHistory = clientHistory.length
    ? clientHistory.slice(-(CONFIG.maxHistoryTurns * 2))
    : getRecentHistory(sessionId);
  const retrievalQuery = buildRetrievalQuery(userMessage, recentHistory);

  let retrieved;
  try {
    retrieved = isBalRelatedQuery(retrievalQuery)
      ? await retrieve(retrievalQuery, CONFIG.retrievalTopK)
      : [];
  } catch {
    return Response.json(
      {
        error: "Şu anda çok yoğumuz. Lütfen biraz sonra tekrar dene.",
        error_type: "retry",
      },
      { status: 503 },
    );
  }

  const context = formatContext(retrieved, CONFIG.retrievalScoreThreshold);

  // ============ NEW: Full request token validation ============
  const totalTokens = estimateMessageTokens(userMessage, context, recentHistory);
  if (totalTokens > MAX_TOTAL_REQUEST_TOKENS) {
    return Response.json(
      {
        error: `İstek çok karmaşık (${totalTokens} tokens, maksimum ${MAX_TOTAL_REQUEST_TOKENS}). Biraz daha spesifik bir soru sorun.`,
        error_type: "quota",
      },
      { status: 429 },
    );
  }
  // ===========================================================

  const augmentedMessage = buildAugmentedUserMessage(userMessage, context);

  // Initialize the stream iterator before committing to 200 status
  let streamIterator: AsyncIterableIterator<Record<string, unknown>>;
  try {
    streamIterator = streamChat(recentHistory, augmentedMessage, {
      googleSearch:
        CONFIG.geminiSearchGrounding &&
        shouldUseGoogleSearch(retrievalQuery),
    })[
      Symbol.asyncIterator
    ]();
  } catch {
    return Response.json(
      {
        error: "Şu anda çok yoğumuz. Lütfen biraz sonra tekrar dene.",
        error_type: "technical",
      },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullResponse = "";
      let hadError = false;
      let savedQuestionIndex: number | null = null;
      const active = incrementActiveRequests();
      const responseSources = buildSourcesPayload(
        retrieved,
        CONFIG.retrievalScoreThreshold,
      );

      try {
        if (active >= CONFIG.congestionThreshold) {
          controller.enqueue(
            encoder.encode(sse({ congestion: true, active_requests: active })),
          );
        }

        for await (const event of streamIterator) {
          if ("__full_response__" in event) {
            fullResponse = event.__full_response__ as string;
            continue;
          }

          if ("error" in event) {
            console.error("[STREAM ERROR]", JSON.stringify(event, null, 2));
            hadError = true;
          }

          controller.enqueue(encoder.encode(sse(event)));
        }
      } catch (error) {
        hadError = true;
        console.error(
          "[STREAM CATCH ERROR]",
          error instanceof Error ? error.message : error,
        );
        console.error("[FULL ERROR OBJECT]", JSON.stringify(error, null, 2));

        controller.enqueue(
          encoder.encode(
            sse({ error: "Teknik bir sorun oluştu.", error_type: "technical" }),
          ),
        );
      } finally {
        decrementActiveRequests();
      }

      if (fullResponse && !hadError) {
        appendTurn(sessionId, userMessage, fullResponse);
        try {
          savedQuestionIndex = await saveChatLog(
            identity,
            userMessage,
            fullResponse,
          );
        } catch {
          savedQuestionIndex = null;
        }
        if (cacheKey) {
          try {
            await saveCachedChatResponse(
              cacheKey,
              userMessage,
              fullResponse,
              responseSources,
            );
          } catch (error) {
            console.warn(
              "[CACHE WRITE ERROR]",
              error instanceof Error ? error.message : error,
            );
          }
        }
      }

      const donePayload: Record<string, unknown> = {
        done: true,
        sources: responseSources,
        near_limit: updatedQuota.daily_remaining <= 10,
      };

      if (savedQuestionIndex) donePayload.question_index = savedQuestionIndex;

      controller.enqueue(encoder.encode(sse(donePayload)));
      controller.close();
    },
  });

  return streamResponse(stream);
}

function cachedStream(
  answer: string,
  sources: Array<{ breadcrumb: string; score: number }>,
  questionIndex: number | undefined,
  nearLimit: boolean,
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sse({ token: answer, cached: true })));
      controller.enqueue(
        encoder.encode(
          sse({
            done: true,
            cached: true,
            sources,
            near_limit: nearLimit,
            ...(questionIndex ? { question_index: questionIndex } : {}),
          }),
        ),
      );
      controller.close();
    },
  });
}

function parseClientHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-(CONFIG.maxHistoryTurns * 2))
    .flatMap((item): ChatMessage[] => {
      if (!item || typeof item !== "object") return [];
      const role = "role" in item ? item.role : null;
      const content = "content" in item ? item.content : null;
      if (
        (role !== "user" && role !== "assistant") ||
        typeof content !== "string" ||
        !content.trim()
      ) {
        return [];
      }
      return [{ role, content: content.trim().slice(0, 8000) }];
    });
}
