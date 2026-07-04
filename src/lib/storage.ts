import { Pool } from "pg";
import { CONFIG } from "./config";
import type { Identity } from "./types";

type Role = Identity["role"];

type MemoryUser = {
  id: number;
  fingerprint: string;
  role: Role;
  createdAt: string;
};

type MemoryLog = {
  userId: number;
  questionIndex: number;
  question: string;
  answer: string;
  createdAt: string;
  feedback?: string | null;
  feedbackText?: string | null;
};

export type FeedbackRecord = {
  id: number | null;
  user_id: number;
  question_index: number;
  question: string;
  answer: string;
  created_at: string;
  feedback: string | null;
  feedback_text: string | null;
};

export type SuggestionRecord = {
  id: number | null;
  user_id: number;
  content: string;
  created_at: string;
};

type MemorySuggestion = {
  userId: number;
  content: string;
  createdAt: string;
};

const globalState = globalThis as typeof globalThis & {
  balPool?: Pool;
  balSchemaReady?: Promise<void>;
  balUsers?: Map<string, MemoryUser>;
  balUsage?: Map<string, number>;
  balLogs?: MemoryLog[];
  balSuggestions?: MemorySuggestion[];
  balNextUserId?: number;
};

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!globalState.balPool) {
    const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
    const isLocal = /localhost|127\.0\.0\.1/i.test(connectionString);
    globalState.balPool = new Pool({
      connectionString,
      ssl: isLocal || process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return globalState.balPool;
}

function normalizeDatabaseUrl(value: string) {
  const url = new URL(value);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  return url.toString();
}

function memoryUsers() {
  if (!globalState.balUsers) globalState.balUsers = new Map();
  return globalState.balUsers;
}

function memoryUsage() {
  if (!globalState.balUsage) globalState.balUsage = new Map();
  return globalState.balUsage;
}

function memoryLogs() {
  if (!globalState.balLogs) globalState.balLogs = [];
  return globalState.balLogs;
}

function memorySuggestions() {
  if (!globalState.balSuggestions) globalState.balSuggestions = [];
  return globalState.balSuggestions;
}

export async function ensureSchema() {
  const pool = getPool();
  if (!pool) return;
  if (!globalState.balSchemaReady) {
    globalState.balSchemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        fingerprint VARCHAR(255) UNIQUE,
        password_hash TEXT,
        provider VARCHAR(32) NOT NULL DEFAULT 'fingerprint',
        role VARCHAR(32) NOT NULL DEFAULT 'visitor',
        created_at VARCHAR(64) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usage_counters (
        subject_type VARCHAR(32) NOT NULL,
        subject_id VARCHAR(255) NOT NULL,
        period_type VARCHAR(32) NOT NULL,
        period_key VARCHAR(64) NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (subject_type, subject_id, period_type, period_key)
      );

      CREATE TABLE IF NOT EXISTS chat_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        question_index INTEGER NOT NULL DEFAULT 0,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        feedback VARCHAR(16),
        feedback_text TEXT
      );

      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS ix_chat_logs_user_question ON chat_logs (user_id, question_index);
    `)
      .then(() => undefined)
      .catch((error) => {
        globalState.balSchemaReady = undefined;
        throw error;
      });
  }
  await globalState.balSchemaReady;
}

export function getClientFingerprint(headers: Headers) {
  const fingerprint = (headers.get("x-client-fingerprint") || "").trim();
  if (!fingerprint) return null;
  return /^[A-Za-z0-9_-]{8,255}$/.test(fingerprint) ? fingerprint : null;
}

export async function getIdentity(headers: Headers): Promise<Identity | null> {
  const fingerprint = getClientFingerprint(headers);
  if (!fingerprint) return null;

  const pool = getPool();
  const now = new Date().toISOString();

  if (pool) {
    await ensureSchema();
    const existing = await pool.query("SELECT id, role FROM users WHERE fingerprint = $1", [fingerprint]);
    let row = existing.rows[0] as { id: number; role: Role } | undefined;
    if (!row) {
      const inserted = await pool.query(
        `INSERT INTO users (email, fingerprint, password_hash, provider, role, created_at)
         VALUES (NULL, $1, NULL, 'fingerprint', 'visitor', $2)
         ON CONFLICT (fingerprint) DO UPDATE SET fingerprint = EXCLUDED.fingerprint
         RETURNING id, role`,
        [fingerprint, now],
      );
      row = inserted.rows[0] as { id: number; role: Role };
    }
    return identityFromUser(row.id, row.role);
  }

  const users = memoryUsers();
  let user = users.get(fingerprint);
  if (!user) {
    globalState.balNextUserId = globalState.balNextUserId || 1;
    user = {
      id: globalState.balNextUserId,
      fingerprint,
      role: "visitor",
      createdAt: now,
    };
    globalState.balNextUserId += 1;
    users.set(fingerprint, user);
  }
  return identityFromUser(user.id, user.role);
}

export async function quotaSnapshot(identity: Identity) {
  const limits = CONFIG.limits[identity.role];
  const dailyUsed = await getUsage(identity, "day", todayKey());
  const minuteUsed = await getUsage(identity, "minute", minuteKey());
  return {
    daily_limit: limits.daily,
    daily_used: dailyUsed,
    daily_remaining: Math.max(limits.daily - dailyUsed, 0),
    minute_limit: limits.minute,
    minute_used: minuteUsed,
    minute_remaining: Math.max(limits.minute - minuteUsed, 0),
  };
}

export async function checkQuota(identity: Identity) {
  const usage = await quotaSnapshot(identity);
  if (usage.daily_remaining <= 0) return { ok: false, usage, error: "Günlük soru limitin doldu." };
  if (usage.minute_remaining <= 0) {
    return { ok: false, usage, error: "Dakikalık soru limitine ulaştın. Biraz bekleyip tekrar dene." };
  }
  return { ok: true, usage, error: "" };
}

export async function incrementUsage(identity: Identity) {
  const now = new Date().toISOString();
  for (const [periodType, periodKey] of [
    ["day", todayKey()],
    ["minute", minuteKey()],
  ] as const) {
    const pool = getPool();
    if (pool) {
      await ensureSchema();
      await pool.query(
        `INSERT INTO usage_counters (subject_type, subject_id, period_type, period_key, count, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5)
         ON CONFLICT (subject_type, subject_id, period_type, period_key)
         DO UPDATE SET count = usage_counters.count + 1, updated_at = EXCLUDED.updated_at`,
        [identity.subjectType, identity.subjectId, periodType, periodKey, now],
      );
    } else {
      const usage = memoryUsage();
      const key = usageKey(identity, periodType, periodKey);
      usage.set(key, (usage.get(key) || 0) + 1);
    }
  }
  return quotaSnapshot(identity);
}

export async function saveChatLog(identity: Identity, question: string, answer: string) {
  const userId = Number(identity.subjectId);
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    const last = await pool.query("SELECT MAX(question_index) AS max FROM chat_logs WHERE user_id = $1", [userId]);
    const questionIndex = Number(last.rows[0]?.max || 0) + 1;
    await pool.query(
      `INSERT INTO chat_logs (user_id, question_index, question, answer, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, questionIndex, question, answer, new Date().toISOString()],
    );
    return questionIndex;
  }

  const logs = memoryLogs();
  const questionIndex = logs.filter((log) => log.userId === userId).length + 1;
  logs.push({ userId, questionIndex, question, answer, createdAt: new Date().toISOString() });
  return questionIndex;
}

export async function saveFeedback(identity: Identity, questionIndex: number, feedback?: string, feedbackText?: string) {
  const userId = Number(identity.subjectId);
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    const result = await pool.query(
      `UPDATE chat_logs
       SET feedback = COALESCE($3, feedback),
           feedback_text = COALESCE($4, feedback_text)
       WHERE user_id = $1 AND question_index = $2`,
      [userId, questionIndex, feedbackText ? "feedback" : feedback || null, feedbackText || null],
    );
    return (result.rowCount || 0) > 0;
  }

  const log = memoryLogs().find((item) => item.userId === userId && item.questionIndex === questionIndex);
  if (!log) return false;
  if (feedback) log.feedback = feedback;
  if (feedbackText) {
    log.feedback = "feedback";
    log.feedbackText = feedbackText;
  }
  return true;
}

export async function listFeedback(limit = 100): Promise<FeedbackRecord[]> {
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    const result = await pool.query(
      `SELECT id, user_id, question_index, question, answer, created_at, feedback, feedback_text
       FROM chat_logs
       WHERE feedback IS NOT NULL OR feedback_text IS NOT NULL
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows as FeedbackRecord[];
  }

  return memoryLogs()
    .filter((item) => item.feedback || item.feedbackText)
    .slice(-limit)
    .reverse()
    .map((item) => ({
      id: null,
      user_id: item.userId,
      question_index: item.questionIndex,
      question: item.question,
      answer: item.answer,
      created_at: item.createdAt,
      feedback: item.feedback || null,
      feedback_text: item.feedbackText || null,
    }));
}

export async function saveSuggestion(identity: Identity, content: string) {
  const userId = Number(identity.subjectId);
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      );
    `);
    await pool.query(
      `INSERT INTO suggestions (user_id, content, created_at)
       VALUES ($1, $2, $3)`,
      [userId, content, new Date().toISOString()],
    );
    return true;
  }
  const suggestions = memorySuggestions();
  suggestions.push({ userId, content, createdAt: new Date().toISOString() });
  return true;
}

export async function listSuggestions(limit = 100): Promise<SuggestionRecord[]> {
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      );
    `);
    const result = await pool.query(
      `SELECT id, user_id, content, created_at
       FROM suggestions
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows as SuggestionRecord[];
  }
  return memorySuggestions()
    .slice(-limit)
    .reverse()
    .map((item) => ({
      id: null,
      user_id: item.userId,
      content: item.content,
      created_at: item.createdAt,
    }));
}

export async function databaseReady() {
  const pool = getPool();
  if (!pool) return true;
  try {
    await ensureSchema();
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function checkSuggestionQuota(identity: Identity) {
  const dailyUsed = await getUsageForType(identity, "suggestion", "day", todayKey());
  const minuteUsed = await getUsageForType(identity, "suggestion", "minute", minuteKey());

  if (dailyUsed >= 5) {
    return { ok: false, error: "Günlük öneri limitine ulaştın (Maksimum 5)." };
  }
  if (minuteUsed >= 1) {
    return { ok: false, error: "Çok hızlı öneri gönderiyorsun. Lütfen biraz bekleyip tekrar dene." };
  }
  return { ok: true };
}

export async function incrementSuggestionUsage(identity: Identity) {
  const now = new Date().toISOString();
  for (const [periodType, periodKey] of [
    ["day", todayKey()],
    ["minute", minuteKey()],
  ] as const) {
    const pool = getPool();
    if (pool) {
      await ensureSchema();
      await pool.query(
        `INSERT INTO usage_counters (subject_type, subject_id, period_type, period_key, count, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5)
         ON CONFLICT (subject_type, subject_id, period_type, period_key)
         DO UPDATE SET count = usage_counters.count + 1, updated_at = EXCLUDED.updated_at`,
        ["suggestion", identity.subjectId, periodType, periodKey, now],
      );
    } else {
      const usage = memoryUsage();
      const key = `suggestion:${identity.subjectId}:${periodType}:${periodKey}`;
      usage.set(key, (usage.get(key) || 0) + 1);
    }
  }
}

async function getUsageForType(identity: Identity, subjectType: string, periodType: "day" | "minute", periodKey: string) {
  const pool = getPool();
  if (pool) {
    await ensureSchema();
    const result = await pool.query(
      "SELECT count FROM usage_counters WHERE subject_type = $1 AND subject_id = $2 AND period_type = $3 AND period_key = $4",
      [subjectType, identity.subjectId, periodType, periodKey],
    );
    return Number(result.rows[0]?.count || 0);
  }
  const key = `${subjectType}:${identity.subjectId}:${periodType}:${periodKey}`;
  return memoryUsage().get(key) || 0;
}

async function getUsage(identity: Identity, periodType: "day" | "minute", periodKey: string) {
  return getUsageForType(identity, identity.subjectType, periodType, periodKey);
}

function identityFromUser(id: number, role: Role): Identity {
  return {
    subjectType: "user",
    subjectId: String(id),
    role,
    public: {
      id,
      email: null,
      role,
      mode: "visitor",
    },
  };
}

function usageKey(identity: Identity, periodType: string, periodKey: string) {
  return `${identity.subjectType}:${identity.subjectId}:${periodType}:${periodKey}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function minuteKey() {
  return new Date().toISOString().slice(0, 16);
}
