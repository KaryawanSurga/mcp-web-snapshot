import { describe, expect, it } from "vitest";
import { extractLinks } from "../src/core/links.js";

const html = `
  <nav>
    <a href="/docs">Docs</a>
    <a href="/docs">Docs again</a>
    <a href="https://external.example.com/blog">Blog</a>
    <a href="mailto:hi@example.com">Mail</a>
    <a href="javascript:void(0)">None</a>
    <a href="/docs#section">Section</a>
  </nav>
`;

describe("extractLinks", () => {
  it("returns deduplicated absolute http links", () => {
    const links = extractLinks(html, "https://example.com/page");
    expect(links.map((link) => link.url)).toEqual([
      "https://example.com/docs",
      "https://external.example.com/blog",
    ]);
    expect(links[0]?.text).toBe("Docs");
  });

  it("filters to the same origin when asked", () => {
    const links = extractLinks(html, "https://example.com/page", { sameOriginOnly: true });
    expect(links.map((link) => link.url)).toEqual(["https://example.com/docs"]);
  });

  it("respects the limit", () => {
    const links = extractLinks(html, "https://example.com/page", { limit: 1 });
    expect(links).toHaveLength(1);
  });
});
