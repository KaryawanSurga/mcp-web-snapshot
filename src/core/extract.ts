import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractedArticle {
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  contentHtml: string;
}

export interface ExtractedPage {
  title?: string;
  contentHtml: string;
}

function withBaseTag(html: string, url: string): string {
  if (/<base\s/i.test(html)) {
    return html;
  }
  const tag = `<base href="${url.replace(/"/g, "&quot;")}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${tag}`);
  }
  return `${tag}${html}`;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function extractArticle(html: string, url: string): ExtractedArticle | undefined {
  const { document } = parseHTML(withBaseTag(html, url));
  const reader = new Readability(document as never);
  const parsed = reader.parse();
  if (parsed === null || typeof parsed.content !== "string" || parsed.content.trim().length === 0) {
    return undefined;
  }
  const article: ExtractedArticle = { contentHtml: parsed.content };
  const title = stringOrUndefined(parsed.title);
  const byline = stringOrUndefined(parsed.byline);
  const excerpt = stringOrUndefined(parsed.excerpt);
  const siteName = stringOrUndefined(parsed.siteName);
  if (title !== undefined) {
    article.title = title;
  }
  if (byline !== undefined) {
    article.byline = byline;
  }
  if (excerpt !== undefined) {
    article.excerpt = excerpt;
  }
  if (siteName !== undefined) {
    article.siteName = siteName;
  }
  return article;
}

const STRIPPED_TAGS = [
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "svg",
  "form",
  "nav",
  "footer",
  "aside",
];

export function extractFullPage(html: string, url: string): ExtractedPage {
  const { document } = parseHTML(withBaseTag(html, url));
  for (const selector of STRIPPED_TAGS) {
    for (const node of document.querySelectorAll(selector)) {
      node.remove();
    }
  }
  const body = document.querySelector("body");
  const page: ExtractedPage = { contentHtml: body?.innerHTML ?? document.toString() };
  const title = stringOrUndefined(document.title);
  if (title !== undefined) {
    page.title = title;
  }
  return page;
}
