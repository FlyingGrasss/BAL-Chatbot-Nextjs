export const CONFIG = {
  provider: "groq",
  embeddingModel: process.env.EMBEDDING_MODEL || "intfloat/multilingual-e5-small",
  retrievalTopK: Number(process.env.RETRIEVAL_TOP_K || 5),
  retrievalScoreThreshold: Number(process.env.RETRIEVAL_SCORE_THRESHOLD || 0.35),
  groqUrl: "https://api.groq.com/openai/v1/chat/completions",
  groqModelChain: csv(process.env.GROQ_MODEL_CHAIN, [
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "qwen/qwen3-32b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
  ]),
  groqApiKeys: groqKeys(),
  groqTimeoutMs: Number(process.env.GROQ_TIMEOUT_MS || 120000),
  llmTemperature: Number(process.env.LLM_TEMPERATURE || 0.1),
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS || 1024),
  llmTopP: Number(process.env.LLM_TOP_P || 0.9),
  maxHistoryTurns: Number(process.env.MAX_HISTORY_TURNS || 6),
  congestionThreshold: Number(process.env.CONGESTION_THRESHOLD || 4),
  limits: {
    visitor: { daily: 40, minute: 5 },
    user: { daily: 50, minute: 8 },
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
