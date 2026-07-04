// Rough token estimation (more accurate than character count)
// 1 token ≈ 4 characters for English, adjust for Turkish

const CHARS_PER_TOKEN = 4; // Conservative estimate

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Turkish text tends to use longer words, so be more conservative
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(
  userMessage: string,
  context: string = "",
  recentHistory: Array<{ role: string; content: string }> = []
): number {
  let total = 0;

  // User message
  total += estimateTokens(userMessage);

  // RAG context
  total += estimateTokens(context);

  // Recent history (last 3-5 messages)
  const historyWindow = recentHistory.slice(-6); // ~3 turns
  for (const msg of historyWindow) {
    total += estimateTokens(msg.content || "");
  }

  // Add overhead for system prompt, formatting, tool calls
  total += 500;

  return total;
}
