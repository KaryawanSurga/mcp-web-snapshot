import { fetchPage, type FetchOptions } from "./fetch.js";
import { extractArticle, extractFullPage } from "./extract.js";
import { htmlToMarkdown } from "./markdown.js";
import { extractLinks, type PageLink } from "./links.js";
import { DEFAULT_BUDGET, fitToBudget, formatTokens } from "./tokens.js";

export interface SnapshotOptions {
  budget?: number;
  readability?: boolean;
  includeLinks?: boolean;
  sameOriginLinks?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

export interface SnapshotResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  bytes: number;
  sizeLimited: boolean;
  markdown: string;
  tokens: number;
  truncated: boolean;
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  links?: PageLink[];
}

function isHtml(contentType: string): boolean {
  return contentType.length === 0 || contentType.includes("html");
}

export async function snapshotUrl(rawUrl: string, options: SnapshotOptions = {}): Promise<SnapshotResult> {
  const fetchOptions: FetchOptions = {};
  if (options.timeoutMs !== undefined) {
    fetchOptions.timeoutMs = options.timeoutMs;
  }
  if (options.maxBytes !== undefined) {
    fetchOptions.maxBytes = options.maxBytes;
  }
  if (options.userAgent !== undefined) {
    fetchOptions.userAgent = options.userAgent;
  }

  const fetched = await fetchPage(rawUrl, fetchOptions);

  let markdown: string;
  let title: string | undefined;
  let byline: string | undefined;
  let excerpt: string | undefined;
  let siteName: string | undefined;

  if (isHtml(fetched.contentType)) {
    if (options.readability === false) {
      const page = extractFullPage(fetched.body, fetched.finalUrl);
      title = page.title;
      markdown = htmlToMarkdown(page.contentHtml, fetched.finalUrl);
    } else {
      const article = extractArticle(fetched.body, fetched.finalUrl);
      if (article !== undefined) {
        title = article.title;
        byline = article.byline;
        excerpt = article.excerpt;
        siteName = article.siteName;
        markdown = htmlToMarkdown(article.contentHtml, fetched.finalUrl);
      } else {
        const page = extractFullPage(fetched.body, fetched.finalUrl);
        title = page.title;
        markdown = htmlToMarkdown(page.contentHtml, fetched.finalUrl);
      }
    }
  } else {
    markdown = fetched.body.trim();
  }

  const budget = options.budget ?? DEFAULT_BUDGET;
  const fitted = fitToBudget(markdown, budget);

  const result: SnapshotResult = {
    requestedUrl: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    contentType: fetched.contentType,
    bytes: fetched.bytes,
    sizeLimited: fetched.sizeLimited,
    markdown: fitted.text,
    tokens: fitted.tokens,
    truncated: fitted.truncated,
  };
  if (title !== undefined) {
    result.title = title;
  }
  if (byline !== undefined) {
    result.byline = byline;
  }
  if (excerpt !== undefined) {
    result.excerpt = excerpt;
  }
  if (siteName !== undefined) {
    result.siteName = siteName;
  }
  if (options.includeLinks === true) {
    result.links = extractLinks(fetched.body, fetched.finalUrl, {
      sameOriginOnly: options.sameOriginLinks === true,
    });
  }

  return result;
}

export function renderSnapshotText(result: SnapshotResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.title ?? result.finalUrl}`);
  if (result.byline !== undefined) {
    lines.push(`By: ${result.byline}`);
  }
  const meta = [
    `Source: ${result.finalUrl}`,
    `HTTP ${result.status}`,
    `${formatTokens(result.bytes)} bytes`,
    `~${formatTokens(result.tokens)} tokens`,
  ];
  if (result.sizeLimited) {
    meta.push("download size capped");
  }
  if (result.truncated) {
    meta.push("truncated to budget");
  }
  lines.push(meta.join(" | "));
  lines.push("", result.markdown);
  if (result.links !== undefined && result.links.length > 0) {
    lines.push("", "## Links");
    for (const link of result.links) {
      lines.push(`- [${link.text.length > 0 ? link.text : link.url}](${link.url})`);
    }
  }
  return lines.join("\n");
}
