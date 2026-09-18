import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshotUrl } from "../src/core/snapshot.js";
import { fixture, startTestServer, type TestServer } from "./helpers/http-server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer({
    "/article": { body: fixture("article.html") },
    "/dashboard": { body: fixture("no-article.html") },
    "/plain": { body: "plain text body", type: "text/plain; charset=utf-8" },
  });
});

afterAll(async () => {
  await server.close();
});

describe("snapshotUrl", () => {
  it("turns an article into clean markdown", async () => {
    const result = await snapshotUrl(`${server.url}/article`, { budget: 4000 });

    expect(result.title ?? "").toContain("Getting Started");
    expect(result.markdown).toContain("npm install widgets");
    expect(result.markdown).toContain("API reference");
    expect(result.markdown).toContain(`http://127.0.0.1:${new URL(server.url).port}/docs/api`);
    expect(result.markdown).not.toContain("Buy now");
    expect(result.markdown).not.toContain("Copyright Widget Inc.");
    expect(result.tokens).toBeGreaterThan(10);
    expect(result.truncated).toBe(false);
    expect(result.status).toBe(200);
  });

  it("truncates to a tiny budget", async () => {
    const result = await snapshotUrl(`${server.url}/article`, { budget: 30 });
    expect(result.truncated).toBe(true);
    expect(result.tokens).toBeLessThanOrEqual(30);
  });

  it("returns plain text untouched by html conversion", async () => {
    const result = await snapshotUrl(`${server.url}/plain`);
    expect(result.markdown.trim()).toBe("plain text body");
  });

  it("falls back for pages without an article", async () => {
    const result = await snapshotUrl(`${server.url}/dashboard`);
    expect(result.title).toBe("Dashboard");
    expect(result.markdown).toContain("Static dashboard content");
  });

  it("keeps the full page when readability is disabled", async () => {
    const result = await snapshotUrl(`${server.url}/article`, { readability: false });
    expect(result.title ?? "").toContain("Getting Started");
    expect(result.markdown).toContain("small building blocks");
  });

  it("includes links when requested", async () => {
    const result = await snapshotUrl(`${server.url}/article`, { includeLinks: true, sameOriginLinks: true });
    const urls = (result.links ?? []).map((link) => link.url);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.startsWith(server.url))).toBe(true);
  });
});
