import { CONFIG } from "./config";
import type { ChatMessage } from "./types";

const globalState = globalThis as typeof globalThis & {
  balConversationSessions?: Map<string, ChatMessage[]>;
  balActiveRequests?: number;
};

function sessions() {
  if (!globalState.balConversationSessions) globalState.balConversationSessions = new Map();
  return globalState.balConversationSessions;
}

export function getRecentHistory(sessionId: string) {
  const history = sessions().get(sessionId) || [];
  return history.slice(-(CONFIG.maxHistoryTurns * 2));
}

export function appendTurn(sessionId: string, userMessage: string, assistantMessage: string) {
  const history = sessions().get(sessionId) || [];
  history.push({ role: "user", content: userMessage }, { role: "assistant", content: assistantMessage });
  sessions().set(sessionId, history.slice(-(CONFIG.maxHistoryTurns * 2)));
}

export function clearSession(sessionId: string) {
  sessions().delete(sessionId);
}

export function incrementActiveRequests() {
  globalState.balActiveRequests = (globalState.balActiveRequests || 0) + 1;
  return globalState.balActiveRequests;
}

export function decrementActiveRequests() {
  globalState.balActiveRequests = Math.max((globalState.balActiveRequests || 1) - 1, 0);
  return globalState.balActiveRequests;
}
