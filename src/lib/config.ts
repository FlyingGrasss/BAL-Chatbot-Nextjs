export const CONFIG = {
  embeddingModel: process.env.EMBEDDING_MODEL || "intfloat/multilingual-e5-small",
  retrievalTopK: Number(process.env.RETRIEVAL_TOP_K || 5),
  retrievalScoreThreshold: Number(process.env.RETRIEVAL_SCORE_THRESHOLD || 0.35),
  geminiUrl:
    process.env.GEMINI_API_URL ||
    "https://generativelanguage.googleapis.com/v1beta/models",
  geminiModelChain: csv(process.env.GEMINI_MODEL_CHAIN, [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
  ]),
  geminiApiKeys: geminiKeys(),
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 120000),
  geminiSearchGrounding: envBoolean(process.env.GEMINI_SEARCH_GROUNDING, true),
  geminiSearchModel:
    process.env.GEMINI_SEARCH_MODEL || "gemini-3.1-flash-lite",
  groqUrl: "https://api.groq.com/openai/v1/chat/completions",
  groqModelChain: csv(process.env.GROQ_MODEL_CHAIN, [
    "llama-3.3-70b-versatile",
    "qwen/qwen3-32b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
  ]),
  groqApiKeys: groqKeys(),
  groqTimeoutMs: Number(process.env.GROQ_TIMEOUT_MS || 120000),
  llmTemperature: Number(process.env.LLM_TEMPERATURE || 0.1),
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS || 1024),
  llmTopP: Number(process.env.LLM_TOP_P || 0.9),
  maxHistoryTurns: Number(process.env.MAX_HISTORY_TURNS || 60),
  congestionThreshold: Number(process.env.CONGESTION_THRESHOLD || 4),
  ipLimits: {
    minute: Number(process.env.IP_MINUTE_LIMIT || 30),
  },
  limits: {
    visitor: { daily: 30, minute: 5 },
    user: { daily: 30, minute: 5 },
    admin: { daily: 500, minute: 20 },
  },
} as const;

function csv(value: string | undefined, fallback: string[]) {
  const parsed = (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function envBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function groqKeys() {
  const candidates = [
    ...csv(process.env.GROQ_API_KEYS, []),
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_Key,
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ];
  return [...new Set(candidates.map((key) => (key || "").trim()).filter(Boolean))];
}

function geminiKeys() {
  const candidates = [
    ...csv(process.env.GEMINI_API_KEYS, []),
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ];
  return [...new Set(candidates.map((key) => (key || "").trim()).filter(Boolean))];
}
