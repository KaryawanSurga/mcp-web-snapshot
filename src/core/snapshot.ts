import { fetchPage, type FetchOptions } from "./fetch.js";
import { extractArticle, extractFullPage } from "./extract.js";
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  fingerprintContentRoot,
  relocateContent,
  similarity,
} from "./fingerprint.js";
import { extractLinks, type PageLink } from "./links.js";
import { htmlToMarkdown } from "./markdown.js";
import { domainOf, memoryKeyOf, SnapshotMemory } from "./memory.js";
import { DEFAULT_BUDGET, fitToBudget, formatTokens } from "./tokens.js";

export interface SnapshotOptions {
  budget?: number;
  readability?: boolean;
  includeLinks?: boolean;
  sameOriginLinks?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  adaptive?: boolean;
  forceAdaptive?: boolean;
  memoryPath?: string;
  similarityThreshold?: number;
}

export interface AdaptiveInfo {
  used: boolean;
  saved: boolean;
  threshold: number;
  score?: number;
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
  adaptive?: AdaptiveInfo;
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

  const adaptiveEnabled = options.adaptive === true || options.forceAdaptive === true;
  const threshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const memory = adaptiveEnabled ? new SnapshotMemory(options.memoryPath) : undefined;
  const memoryDomain = domainOf(fetched.finalUrl);
  const memoryKey = memoryKeyOf(fetched.finalUrl);
  const stored = memory?.recall(memoryDomain, memoryKey);

  let markdown: string;
  let title: string | undefined;
  let byline: string | undefined;
  let excerpt: string | undefined;
  let siteName: string | undefined;
  let adaptiveUsed = false;
  let adaptiveScore: number | undefined;
  let adaptiveSaved = false;

  if (isHtml(fetched.contentType)) {
    let contentHtml: string | undefined;

    if (options.forceAdaptive === true && stored !== undefined) {
      const relocation = relocateContent(fetched.body, stored.fingerprint, DEFAULT_SIMILARITY_THRESHOLD);
      if (relocation.html !== undefined) {
        contentHtml = relocation.html;
        adaptiveUsed = true;
        adaptiveScore = relocation.score;
      }
    }

    if (contentHtml === undefined) {
      if (options.readability === false) {
        const page = extractFullPage(fetched.body, fetched.finalUrl);
        title = page.title;
        contentHtml = page.contentHtml;
      } else {
        const article = extractArticle(fetched.body, fetched.finalUrl);
        if (article !== undefined) {
          title = article.title;
          byline = article.byline;
          excerpt = article.excerpt;
          siteName = article.siteName;
          contentHtml = article.contentHtml;
        } else {
          const page = extractFullPage(fetched.body, fetched.finalUrl);
          title = page.title;
          contentHtml = page.contentHtml;
        }
      }

      if (stored !== undefined && memory !== undefined && options.forceAdaptive !== true) {
        const current = fingerprintContentRoot(fetched.body);
        if (current !== undefined) {
          const score = similarity(stored.fingerprint, current);
          if (score < threshold) {
            const relocation = relocateContent(fetched.body, stored.fingerprint, DEFAULT_SIMILARITY_THRESHOLD);
            if (relocation.html !== undefined) {
              contentHtml = relocation.html;
              adaptiveUsed = true;
              adaptiveScore = relocation.score;
            } else {
              adaptiveScore = score;
            }
          } else {
            adaptiveScore = score;
          }
        }
      }
    }

    markdown = htmlToMarkdown(contentHtml ?? "", fetched.finalUrl);
  } else {
    markdown = fetched.body.trim();
  }

  if (memory !== undefined) {
    const fingerprint = fingerprintContentRoot(fetched.body);
    if (fingerprint !== undefined) {
      memory.remember(memoryDomain, { key: memoryKey, url: fetched.finalUrl, fingerprint });
      adaptiveSaved = true;
    }
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
  if (memory !== undefined) {
    const adaptive: AdaptiveInfo = { used: adaptiveUsed, saved: adaptiveSaved, threshold };
    if (adaptiveScore !== undefined) {
      adaptive.score = adaptiveScore;
    }
    result.adaptive = adaptive;
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
  if (result.adaptive?.used === true) {
    meta.push(`recovered from memory (${result.adaptive.score ?? 0}% match)`);
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
