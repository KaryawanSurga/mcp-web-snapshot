import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFetchableUrl, fetchPage } from "../src/core/fetch.js";
import { fixture, startTestServer, type TestServer } from "./helpers/http-server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer({
    "/article": { body: fixture("article.html") },
    "/plain": { body: "hello plain text", type: "text/plain; charset=utf-8" },
    "/slow": { body: "too late", delayMs: 3000 },
    "/missing": { body: "gone", status: 404 },
  });
});

afterAll(async () => {
  await server.close();
});

describe("assertFetchableUrl", () => {
  it("accepts http and https and rejects the rest", () => {
    expect(assertFetchableUrl("https://example.com").protocol).toBe("https:");
    expect(() => assertFetchableUrl("ftp://example.com")).toThrow("Unsupported URL scheme");
    expect(() => assertFetchableUrl("not a url")).toThrow("Invalid URL");
  });
});

describe("fetchPage", () => {
  it("fetches a page with metadata", async () => {
    const result = await fetchPage(`${server.url}/article`);
    expect(result.status).toBe(200);
    expect(result.contentType).toContain("text/html");
    expect(result.body).toContain("Getting Started with Widgets");
    expect(result.finalUrl).toContain("/article");
    expect(result.bytes).toBeGreaterThan(100);
  });

  it("fetches plain text", async () => {
    const result = await fetchPage(`${server.url}/plain`);
    expect(result.contentType).toContain("text/plain");
    expect(result.body).toBe("hello plain text");
  });

  it("throws on error statuses", async () => {
    await expect(fetchPage(`${server.url}/missing`)).rejects.toThrow("HTTP 404");
  });

  it("times out slow responses", async () => {
    await expect(fetchPage(`${server.url}/slow`, { timeoutMs: 200 })).rejects.toThrow("timed out");
  });

  it("caps responses at the size limit and flags them", async () => {
    const result = await fetchPage(`${server.url}/article`, { maxBytes: 10 });
    expect(result.sizeLimited).toBe(true);
    expect(result.bytes).toBe(10);
    expect(result.body.length).toBeLessThan(20);
  });
});
