import { describe, expect, it } from "vitest";
import { extractArticle, extractFullPage } from "../src/core/extract.js";
import { fixture } from "./helpers/http-server.js";

const url = "https://docs.example.com/getting-started";

describe("extractArticle", () => {
  it("extracts the main content and drops chrome", () => {
    const article = extractArticle(fixture("article.html"), url);
    expect(article).toBeDefined();
    expect(article?.title ?? "").toContain("Getting Started");
    expect(article?.contentHtml).toContain("small building blocks");
    expect(article?.contentHtml).toContain("npm install widgets");
    expect(article?.contentHtml).not.toContain("Buy now");
    expect(article?.contentHtml).not.toContain("Copyright Widget Inc.");
    expect(article?.contentHtml).not.toContain("console.log");
  });

  it("returns undefined when there is no article", () => {
    const article = extractArticle(fixture("empty.html"), url);
    expect(article).toBeUndefined();
  });
});

describe("extractFullPage", () => {
  it("keeps page content but strips nav, scripts, and footers", () => {
    const page = extractFullPage(fixture("article.html"), url);
    expect(page.title).toContain("Getting Started");
    expect(page.contentHtml).toContain("small building blocks");
    expect(page.contentHtml).not.toContain("Copyright Widget Inc.");
    expect(page.contentHtml).not.toContain("console.log");
  });

  it("works for non-article pages", () => {
    const page = extractFullPage(fixture("no-article.html"), url);
    expect(page.title).toBe("Dashboard");
    expect(page.contentHtml).toContain("Static dashboard content");
  });
});
