export const TRUNCATED_MARKER = "\n\n… (truncated to fit the token budget)";

export const DEFAULT_BUDGET = 4000;

/**
 * Token counts are estimated at roughly four characters per token, which is
 * close enough for budgeting across the common tokenizers and keeps the tool
 * fully offline.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

export interface BudgetResult {
  text: string;
  tokens: number;
  truncated: boolean;
}

export function fitToBudget(text: string, budget: number): BudgetResult {
  const tokens = estimateTokens(text);
  if (budget <= 0 || tokens <= budget) {
    return { text, tokens, truncated: false };
  }
  const maxChars = Math.max(0, budget * 4 - TRUNCATED_MARKER.length);
  const slice = text.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf("\n");
  const body = lastNewline > 0 ? slice.slice(0, lastNewline) : slice;
  const result = `${body.trimEnd()}${TRUNCATED_MARKER}`;
  return { text: result, tokens: estimateTokens(result), truncated: true };
}

export function formatTokens(value: number): string {
  return value.toLocaleString("en-US");
}
