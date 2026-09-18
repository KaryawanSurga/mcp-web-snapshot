import { parseHTML } from "linkedom";

export interface PageLink {
  url: string;
  text: string;
}

export interface ExtractLinksOptions {
  sameOriginOnly?: boolean;
  limit?: number;
}

export const DEFAULT_LINK_LIMIT = 200;

export function extractLinks(html: string, baseUrl: string, options: ExtractLinksOptions = {}): PageLink[] {
  const { document } = parseHTML(html);
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const links: PageLink[] = [];
  const limit = options.limit ?? DEFAULT_LINK_LIMIT;

  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (href === null) {
      continue;
    }
    let resolved: URL;
    try {
      resolved = new URL(href.trim(), baseUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      continue;
    }
    if (options.sameOriginOnly === true && resolved.origin !== origin) {
      continue;
    }
    resolved.hash = "";
    const key = resolved.href;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
    links.push({ url: key, text });
    if (links.length >= limit) {
      break;
    }
  }

  return links;
}
