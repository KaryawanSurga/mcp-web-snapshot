export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_BYTES = 2_000_000;
export const DEFAULT_USER_AGENT =
  "mcp-web-snapshot/0.1.0 (+https://github.com/KaryawanSurga/mcp-web-snapshot)";

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

export interface FetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  bytes: number;
  sizeLimited: boolean;
  body: string;
}

export function assertFetchableUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${parsed.protocol} (only http and https are allowed)`);
  }
  return parsed;
}

export async function fetchPage(rawUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  const url = assertFetchableUrl(rawUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.5,*/*;q=0.1",
      },
    });

    const finalUrl = response.url.length > 0 ? response.url : url.href;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${finalUrl}`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Response too large: ${declaredLength} bytes (limit ${maxBytes})`);
    }

    const buffer = await response.arrayBuffer();
    const sizeLimited = buffer.byteLength > maxBytes;
    const sliced = sizeLimited ? buffer.slice(0, maxBytes) : buffer;
    const body = new TextDecoder("utf-8").decode(sliced);

    return {
      requestedUrl: url.href,
      finalUrl,
      status: response.status,
      contentType,
      bytes: sliced.byteLength,
      sizeLimited,
      body,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url.href}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
