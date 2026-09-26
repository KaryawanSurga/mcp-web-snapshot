import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  findContentRoot,
  fingerprintContentRoot,
  fingerprintElement,
  relocateContent,
  similarity,
  type ElementFingerprint,
} from "../src/core/fingerprint.js";

function fingerprintOf(html: string, selector: string): ElementFingerprint {
  const { document } = parseHTML(html);
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`Selector not found: ${selector}`);
  }
  return fingerprintElement(element as never);
}

const pageA = `<!doctype html><html><body><main>
  <article id="post"><h1>Getting Started</h1>
  <p>Widgets are small building blocks. This guide shows how to install and use them in your project.</p>
  <p>Every section includes a short example so you can copy the pattern into your own code and adjust it.</p>
  </article></main></body></html>`;

const restructured = `<!doctype html><html><body><div class="landing">
  <article data-kind="story"><h1>Getting Started</h1>
  <p>Widgets are small building blocks. This guide shows how to install and use them in your project.</p>
  <p>Every section includes a short example so you can copy the pattern into your own code and adjust it.</p>
  </article></div></body></html>`;

const unrelated = `<!doctype html><html><body><div class="x"><span>totally different content here</span></div></body></html>`;

describe("fingerprintElement", () => {
  it("captures tag, id, classes, attributes, path, parent, and text", () => {
    const fingerprint = fingerprintOf(
      `<html><body><main><article id="post" class="beta alpha" data-kind="story">
        <p>Hello world</p></article></main></body></html>`,
      "article",
    );
    expect(fingerprint.tag).toBe("article");
    expect(fingerprint.id).toBe("post");
    expect(fingerprint.classes).toEqual(["alpha", "beta"]);
    expect(fingerprint.attributes).toEqual(["data-kind=story"]);
    expect(fingerprint.path).toEqual(["html", "body", "main"]);
    expect(fingerprint.parentTag).toBe("main");
    expect(fingerprint.textLength).toBe("hello world".length);
    expect(fingerprint.textHash).toHaveLength(40);
  });

  it("omits empty ids and class lists", () => {
    const fingerprint = fingerprintOf("<html><body><p>text</p></body></html>", "p");
    expect(fingerprint.id).toBeUndefined();
    expect(fingerprint.classes).toEqual([]);
  });
});

describe("similarity", () => {
  it("scores identical fingerprints at 100", () => {
    const left = fingerprintOf(pageA, "article");
    const right = fingerprintOf(pageA, "article");
    expect(similarity(left, right)).toBe(100);
  });

  it("scores a restructured page with the same text above the threshold", () => {
    const left = fingerprintOf(pageA, "article");
    const right = fingerprintOf(restructured, "article");
    const score = similarity(left, right);
    expect(score).toBeGreaterThanOrEqual(40);
  });

  it("scores unrelated content below the threshold", () => {
    const left = fingerprintOf(pageA, "article");
    const right = fingerprintOf(unrelated, "div");
    expect(similarity(left, right)).toBeLessThan(40);
  });
});

describe("findContentRoot and fingerprintContentRoot", () => {
  it("prefers article containers over the body", () => {
    const root = findContentRoot(pageA);
    expect(root).toContain("<article");
  });

  it("ignores tiny documents", () => {
    expect(findContentRoot("<html><body><p>short</p></body></html>")).toBeUndefined();
    expect(fingerprintContentRoot("<html><body><p>short</p></body></html>")).toBeUndefined();
  });

  it("fingerprints the content root", () => {
    const fingerprint = fingerprintContentRoot(pageA);
    expect(fingerprint?.tag).toBe("article");
    expect(fingerprint?.id).toBe("post");
  });
});

describe("relocateContent", () => {
  it("finds the best matching element in restructured html", () => {
    const target = fingerprintOf(pageA, "article");
    const result = relocateContent(restructured, target);
    expect(result.html).toBeDefined();
    expect(result.html).toContain("small building blocks");
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.tag).toBe("article");
  });

  it("returns only the score when nothing passes the threshold", () => {
    const target = fingerprintOf(pageA, "article");
    const result = relocateContent(unrelated, target);
    expect(result.html).toBeUndefined();
    expect(result.score).toBeLessThan(40);
  });
});
