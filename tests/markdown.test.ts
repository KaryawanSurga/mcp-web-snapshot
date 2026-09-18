import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "../src/core/markdown.js";

const base = "https://example.com/docs/page";

describe("htmlToMarkdown", () => {
  it("renders headings and paragraphs", () => {
    const markdown = htmlToMarkdown("<h1>Title</h1><p>Hello there.</p>", base);
    expect(markdown).toContain("# Title");
    expect(markdown).toContain("Hello there.");
  });

  it("resolves relative links against the base url", () => {
    const markdown = htmlToMarkdown('<p>See <a href="/api">API</a></p>', base);
    expect(markdown).toContain("[API](https://example.com/api)");
  });

  it("resolves relative images against the base url", () => {
    const markdown = htmlToMarkdown('<img src="/img/widget.png" alt="Widget diagram">', base);
    expect(markdown).toContain("![Widget diagram](https://example.com/img/widget.png)");
  });

  it("renders lists and fenced code blocks", () => {
    const markdown = htmlToMarkdown("<ul><li>one</li><li>two</li></ul><pre><code>const a = 1;</code></pre>", base);
    expect(markdown).toMatch(/-\s+one/);
    expect(markdown).toMatch(/-\s+two/);
    expect(markdown).toContain("```");
    expect(markdown).toContain("const a = 1;");
  });

  it("drops javascript links but keeps their text", () => {
    const markdown = htmlToMarkdown('<p><a href="javascript:alert(1)">click</a></p>', base);
    expect(markdown).toContain("click");
    expect(markdown).not.toContain("javascript:");
  });

  it("strips scripts and styles", () => {
    const markdown = htmlToMarkdown('<p>ok</p><script>const x = 1;</script><style>.a{}</style>', base);
    expect(markdown).not.toContain("const x = 1");
    expect(markdown).not.toContain(".a{}");
  });
});
