import { CONFIG } from "./config";
import { SYSTEM_PROMPT } from "./prompt";
import type { ChatMessage } from "./types";

type StreamEvent =
  | { token: string }
  | { error: string; error_type?: string }
  | { model_fallback: { from_model: string; to_model: string; message: string } }
  | { __full_response__: string };

type FailureInfo = {
  retryable: boolean;
  model: string;
  keyIndex: number;
  reason: string;
  statusCode?: number;
};

export function providerStatus() {
  return {
    provider: CONFIG.provider,
    groq: CONFIG.groqApiKeys.length > 0,
    groq_key_count: CONFIG.groqApiKeys.length,
    model_name: CONFIG.groqModelChain[0],
    model_chain: CONFIG.groqModelChain,
    status: CONFIG.groqApiKeys.length ? "ok" : "degraded",
  };
}

export async function* streamChat(recentHistory: ChatMessage[], augmentedMessage: string) {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory,
    { role: "user", content: augmentedMessage },
  ];

  yield* streamGroq(messages);
}

async function* streamGroq(messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
  if (!CONFIG.groqApiKeys.length) {
    yield { error: "GROQ_API_KEY ayarli degil.", error_type: "technical" };
    return;
  }

  let lastError = "Groq API hatasi.";

  for (let keyIndex = 0; keyIndex < CONFIG.groqApiKeys.length; keyIndex += 1) {
    const apiKey = CONFIG.groqApiKeys[keyIndex];
    for (let modelIndex = 0; modelIndex < CONFIG.groqModelChain.length; modelIndex += 1) {
      const model = CONFIG.groqModelChain[modelIndex];
      const attempt = streamGroqModel(messages, model, apiKey, keyIndex + 1);
      let result: { fullResponse: string; failureInfo: FailureInfo | null } | undefined;

      while (true) {
        const next = await attempt.next();
        if (next.done) {
          result = next.value;
          break;
        }
        yield next.value;
      }

      if (result && !result.failureInfo) {
        if (modelIndex > 0) {
          yield {
            model_fallback: {
              from_model: CONFIG.groqModelChain[0],
              to_model: model,
              message: "Yogunluk nedeniyle model degistirildi.",
            },
          };
        }
        yield { __full_response__: stripReasoningBlocks(result.fullResponse) };
        return;
      }

      lastError = result?.fullResponse || lastError;
      if (result?.failureInfo && !result.failureInfo.retryable) {
        yield { error: lastError, error_type: "technical" };
        return;
      }
    }
  }

  yield { error: lastError, error_type: "technical" };
}

async function* streamGroqModel(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  keyIndex: number,
): AsyncGenerator<StreamEvent, { fullResponse: string; failureInfo: FailureInfo | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.groqTimeoutMs);
  let fullResponse = "";

  try {
    const response = await fetch(CONFIG.groqUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: CONFIG.llmTemperature,
        max_tokens: CONFIG.llmMaxTokens,
        top_p: CONFIG.llmTopP,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const statusCode = response.status;
      return {
        fullResponse: `Groq API hatasi: HTTP ${statusCode}${text ? ` ${text.slice(0, 160)}` : ""}`,
        failureInfo: {
          retryable: statusCode === 404 || statusCode === 429 || statusCode >= 500,
          model,
          keyIndex,
          reason: `http_${statusCode}`,
          statusCode,
        },
      };
    }

    if (!response.body) {
      return {
        fullResponse: "Groq API yaniti bos geldi.",
        failureInfo: { retryable: true, model, keyIndex, reason: "empty_body" },
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const event = parseGroqLine(line);
        if (!event) continue;
        if (event === "[DONE]") {
          clearTimeout(timeout);
          return { fullResponse, failureInfo: null };
        }
        fullResponse += event;
        yield { token: event };
      }
    }

    if (buffer.trim()) {
      const event = parseGroqLine(buffer.trim());
      if (event && event !== "[DONE]") {
        fullResponse += event;
        yield { token: event };
      }
    }

    return { fullResponse, failureInfo: null };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "exception";
    return {
      fullResponse: reason === "timeout" ? "Groq API zaman asimina ugradi. Lutfen tekrar deneyin." : "Groq API hatasi.",
      failureInfo: { retryable: true, model, keyIndex, reason },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseGroqLine(line: string) {
  if (!line.startsWith("data: ")) return null;
  const dataText = line.slice(6).trim();
  if (dataText === "[DONE]") return "[DONE]";
  try {
    const data = JSON.parse(dataText) as { choices?: Array<{ delta?: { content?: string } }> };
    return data.choices?.[0]?.delta?.content || "";
  } catch {
    return null;
  }
}

function stripReasoningBlocks(text: string) {
  return text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*$/gi, "")
    .trim();
}
