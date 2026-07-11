import { CONFIG } from "./config";
import { SYSTEM_PROMPT } from "./prompt";
import type { ChatMessage } from "./types";

type StreamEvent =
  | { token: string }
  | { error: string; error_type?: string }
  | { search_grounding: true }
  | { model_fallback: { from_model: string; to_model: string; message: string } }
  | { __full_response__: string };

type FailureInfo = {
  retryable: boolean;
  rotateKey: boolean;
  model: string;
  keyIndex: number;
  reason: string;
  statusCode?: number;
};

type ProviderResult = {
  fullResponse: string;
  failureInfo: FailureInfo | null;
  emittedTokens: boolean;
};

export function providerStatus() {
  const provider = CONFIG.geminiApiKeys.length
    ? "gemini"
    : CONFIG.groqApiKeys.length
      ? "groq"
      : "none";

  return {
    provider,
    gemini: CONFIG.geminiApiKeys.length > 0,
    gemini_key_count: CONFIG.geminiApiKeys.length,
    gemini_model_chain: CONFIG.geminiModelChain,
    google_search_grounding: CONFIG.geminiSearchGrounding,
    google_search_model: CONFIG.geminiSearchModel,
    groq: CONFIG.groqApiKeys.length > 0,
    groq_key_count: CONFIG.groqApiKeys.length,
    groq_model_chain: CONFIG.groqModelChain,
    model_name:
      provider === "gemini"
        ? CONFIG.geminiModelChain[0]
        : CONFIG.groqModelChain[0] || null,
    status: provider === "none" ? "degraded" : "ok",
  };
}

export async function* streamChat(
  recentHistory: ChatMessage[],
  augmentedMessage: string,
  options: { googleSearch?: boolean } = {},
): AsyncGenerator<StreamEvent> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory,
    { role: "user", content: augmentedMessage },
  ];

  if (CONFIG.geminiApiKeys.length && options.googleSearch) {
    const groundedGemini = streamGemini(
      messages,
      true,
      [CONFIG.geminiSearchModel],
    );
    let result: ProviderResult | undefined;

    while (true) {
      const next = await groundedGemini.next();
      if (next.done) {
        result = next.value;
        break;
      }
      yield next.value;
    }

    if (result && !result.failureInfo) {
      yield { search_grounding: true };
      yield { __full_response__: result.fullResponse };
      return;
    }

    if (result?.emittedTokens) {
      yield {
        error: "Gemini yanıt akışı tamamlanamadı. Lütfen tekrar deneyin.",
        error_type: "technical",
      };
      return;
    }
  }

  if (CONFIG.geminiApiKeys.length) {
    const gemini = streamGemini(messages, false, CONFIG.geminiModelChain);
    let result: ProviderResult | undefined;

    while (true) {
      const next = await gemini.next();
      if (next.done) {
        result = next.value;
        break;
      }
      yield next.value;
    }

    if (result && !result.failureInfo) {
      yield { __full_response__: result.fullResponse };
      return;
    }

    if (result?.emittedTokens) {
      yield {
        error: "Gemini yanıt akışı tamamlanamadı. Lütfen tekrar deneyin.",
        error_type: "technical",
      };
      return;
    }

    if (CONFIG.groqApiKeys.length) {
      yield {
        model_fallback: {
          from_model: CONFIG.geminiModelChain[0],
          to_model: CONFIG.groqModelChain[0],
          message: "Gemini kullanılamadığı için yedek modele geçildi.",
        },
      };
    }
  }

  if (CONFIG.groqApiKeys.length) {
    const groq = streamGroq(messages);
    let result: ProviderResult | undefined;

    while (true) {
      const next = await groq.next();
      if (next.done) {
        result = next.value;
        break;
      }
      yield next.value;
    }

    if (result && !result.failureInfo) {
      yield { __full_response__: stripReasoningBlocks(result.fullResponse) };
      return;
    }

    yield {
      error: result?.fullResponse || "Dil modeli şu anda kullanılamıyor.",
      error_type: "technical",
    };
    return;
  }

  yield {
    error: "GEMINI_API_KEY veya GROQ_API_KEY ayarlı değil.",
    error_type: "technical",
  };
}

async function* streamGemini(
  messages: ChatMessage[],
  googleSearch: boolean,
  modelChain: readonly string[],
): AsyncGenerator<StreamEvent, ProviderResult> {
  let lastResult = failedResult("Gemini API hatası.", {
    retryable: true,
    rotateKey: false,
    model: modelChain[0],
    keyIndex: 0,
    reason: "not_attempted",
  });

  for (let modelIndex = 0; modelIndex < modelChain.length; modelIndex += 1) {
    const model = modelChain[modelIndex];

    for (let keyIndex = 0; keyIndex < CONFIG.geminiApiKeys.length; keyIndex += 1) {
      const apiKey = CONFIG.geminiApiKeys[keyIndex];
      const attempt = streamGeminiModel(
        messages,
        model,
        apiKey,
        keyIndex + 1,
        googleSearch,
      );
      let result: ProviderResult | undefined;

      while (true) {
        const next = await attempt.next();
        if (next.done) {
          result = next.value;
          break;
        }
        yield next.value;
      }

      if (!result) continue;
      if (!result.failureInfo) {
        if (modelIndex > 0) {
          yield {
            model_fallback: {
              from_model: modelChain[0],
              to_model: model,
              message: "Gemini yedek modeline geçildi.",
            },
          };
        }
        return result;
      }

      lastResult = result;
      logFailure(googleSearch ? "Gemini Search" : "Gemini", result.failureInfo);
      if (result.emittedTokens) return result;
      if (!result.failureInfo.retryable) break;
    }
  }

  return lastResult;
}

async function* streamGeminiModel(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  keyIndex: number,
  googleSearch: boolean,
): AsyncGenerator<StreamEvent, ProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.geminiTimeoutMs);
  let fullResponse = "";
  let emittedTokens = false;

  try {
    const systemMessage = messages.find((message) => message.role === "system");
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const response = await fetch(
      `${CONFIG.geminiUrl}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: systemMessage
            ? { parts: [{ text: systemMessage.content }] }
            : undefined,
          contents,
          generationConfig: {
            temperature: CONFIG.llmTemperature,
            maxOutputTokens: CONFIG.llmMaxTokens,
            topP: CONFIG.llmTopP,
          },
          tools: googleSearch ? [{ google_search: {} }] : undefined,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const statusCode = response.status;
      const rotateKey = statusCode === 401 || statusCode === 403 || statusCode === 429;
      return failedResult(
        `Gemini API hatası: HTTP ${statusCode}${apiErrorMessage(text)}`,
        {
          retryable: rotateKey || statusCode === 404 || statusCode === 408 || statusCode >= 500,
          rotateKey,
          model,
          keyIndex,
          reason: `http_${statusCode}`,
          statusCode,
        },
      );
    }

    if (!response.body) {
      return failedResult("Gemini API yanıtı boş geldi.", {
        retryable: true,
        rotateKey: false,
        model,
        keyIndex,
        reason: "empty_body",
      });
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
        const token = parseGeminiLine(line);
        if (!token) continue;
        fullResponse += token;
        emittedTokens = true;
        yield { token };
      }
    }

    if (buffer.trim()) {
      const token = parseGeminiLine(buffer.trim());
      if (token) {
        fullResponse += token;
        emittedTokens = true;
        yield { token };
      }
    }

    if (!fullResponse.trim()) {
      return {
        ...failedResult("Gemini API metin yanıtı üretmedi.", {
          retryable: true,
          rotateKey: false,
          model,
          keyIndex,
          reason: "empty_response",
        }),
        emittedTokens,
      };
    }

    return { fullResponse, failureInfo: null, emittedTokens };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "exception";
    return {
      ...failedResult(
        reason === "timeout"
          ? "Gemini API zaman aşımına uğradı. Lütfen tekrar deneyin."
          : "Gemini API bağlantı hatası.",
        { retryable: true, rotateKey: false, model, keyIndex, reason },
      ),
      emittedTokens,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function* streamGroq(
  messages: ChatMessage[],
): AsyncGenerator<StreamEvent, ProviderResult> {
  let lastResult = failedResult("Groq API hatası.", {
    retryable: true,
    rotateKey: false,
    model: CONFIG.groqModelChain[0],
    keyIndex: 0,
    reason: "not_attempted",
  });

  for (let modelIndex = 0; modelIndex < CONFIG.groqModelChain.length; modelIndex += 1) {
    const model = CONFIG.groqModelChain[modelIndex];

    for (let keyIndex = 0; keyIndex < CONFIG.groqApiKeys.length; keyIndex += 1) {
      const apiKey = CONFIG.groqApiKeys[keyIndex];
      const attempt = streamGroqModel(messages, model, apiKey, keyIndex + 1);
      let result: ProviderResult | undefined;

      while (true) {
        const next = await attempt.next();
        if (next.done) {
          result = next.value;
          break;
        }
        yield next.value;
      }

      if (!result) continue;
      if (!result.failureInfo) {
        if (modelIndex > 0) {
          yield {
            model_fallback: {
              from_model: CONFIG.groqModelChain[0],
              to_model: model,
              message: "Yoğunluk nedeniyle yedek modele geçildi.",
            },
          };
        }
        return result;
      }

      lastResult = result;
      logFailure("Groq", result.failureInfo);
      if (result.emittedTokens) return result;
      if (!result.failureInfo.retryable) break;
    }
  }

  return lastResult;
}

async function* streamGroqModel(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  keyIndex: number,
): AsyncGenerator<StreamEvent, ProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.groqTimeoutMs);
  let fullResponse = "";
  let emittedTokens = false;

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
      const rotateKey = statusCode === 401 || statusCode === 403 || statusCode === 429;
      return failedResult(`Groq API hatası: HTTP ${statusCode}${apiErrorMessage(text)}`, {
        retryable: rotateKey || statusCode === 404 || statusCode === 408 || statusCode >= 500,
        rotateKey,
        model,
        keyIndex,
        reason: `http_${statusCode}`,
        statusCode,
      });
    }

    if (!response.body) {
      return failedResult("Groq API yanıtı boş geldi.", {
        retryable: true,
        rotateKey: false,
        model,
        keyIndex,
        reason: "empty_body",
      });
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
        const token = parseGroqLine(line);
        if (!token || token === "[DONE]") continue;
        fullResponse += token;
        emittedTokens = true;
        yield { token };
      }
    }

    return { fullResponse, failureInfo: null, emittedTokens };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "exception";
    return {
      ...failedResult(
        reason === "timeout"
          ? "Groq API zaman aşımına uğradı. Lütfen tekrar deneyin."
          : "Groq API bağlantı hatası.",
        { retryable: true, rotateKey: false, model, keyIndex, reason },
      ),
      emittedTokens,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseGeminiLine(line: string) {
  if (!line.startsWith("data:")) return "";
  const dataText = line.slice(5).trim();
  if (!dataText || dataText === "[DONE]") return "";

  try {
    const data = JSON.parse(dataText) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }>;
    };
    return (data.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("");
  } catch {
    return "";
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

function failedResult(fullResponse: string, failureInfo: FailureInfo): ProviderResult {
  return { fullResponse, failureInfo, emittedTokens: false };
}

function apiErrorMessage(body: string) {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ? ` ${parsed.error.message.slice(0, 180)}` : "";
  } catch {
    return ` ${body.slice(0, 180)}`;
  }
}

function logFailure(provider: string, failure: FailureInfo) {
  console.warn(`${provider} denemesi başarısız.`, {
    keyIndex: failure.keyIndex,
    model: failure.model,
    reason: failure.reason,
    statusCode: failure.statusCode,
    rotateKey: failure.rotateKey,
  });
}

function stripReasoningBlocks(text: string) {
  return text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*$/gi, "")
    .trim();
}
