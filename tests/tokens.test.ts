import { describe, expect, it } from "vitest";
import { estimateTokens, fitToBudget } from "../src/core/tokens.js";

describe("estimateTokens", () => {
  it("approximates four characters per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });
});

describe("fitToBudget", () => {
  it("leaves short text untouched", () => {
    const result = fitToBudget("hello world", 100);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe("hello world");
  });

  it("truncates long text near the budget and says so", () => {
    const long = Array.from({ length: 300 }, (_, index) => `line ${index} ${"x".repeat(40)}`).join("\n");
    const result = fitToBudget(long, 100);

    expect(result.truncated).toBe(true);
    expect(result.tokens).toBeLessThanOrEqual(100);
    expect(result.text).toContain("truncated");
    expect(result.text.length).toBeLessThan(long.length);
  });
});
