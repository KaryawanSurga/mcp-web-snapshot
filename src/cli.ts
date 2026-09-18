import { parseArgs } from "node:util";
import { DEFAULT_MAX_BYTES, DEFAULT_TIMEOUT_MS } from "./core/fetch.js";
import { renderSnapshotText, snapshotUrl, type SnapshotOptions } from "./core/snapshot.js";
import { DEFAULT_BUDGET } from "./core/tokens.js";
import { buildServer, SERVER_VERSION } from "./server.js";

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  color: boolean;
}

export const HELP = `mcp-web-snapshot ${SERVER_VERSION}

Turn any web page into clean, readable markdown for LLM agents.

Usage:
  mcp-web-snapshot <url> [options]
  mcp-web-snapshot snapshot <url> [options]
  mcp-web-snapshot serve
  mcp-web-snapshot --help | --version

Commands:
  snapshot   Fetch a page and print readable markdown (default)
  serve      Run as an MCP server exposing the snapshot tools

Options:
  --budget <tokens>   Approximate token budget (default ${DEFAULT_BUDGET})
  --timeout <ms>      Request timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS})
  --max-bytes <n>     Maximum download size in bytes (default ${DEFAULT_MAX_BYTES})
  --links             Append the page links to the output
  --same-origin       With --links, keep only same-origin links
  --raw               Skip readability and keep the full page structure
  --json              Machine-readable output
  -h, --help          Show this help
  -v, --version       Print the version

Examples:
  mcp-web-snapshot https://example.com/article --budget 3000
  mcp-web-snapshot snapshot https://example.com --links --json
`;

function parsePositiveInt(value: unknown, flag: string, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new Error(`${flag} must be a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

export async function main(argv: string[], io: CliIo): Promise<number> {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      budget: { type: "string" },
      timeout: { type: "string" },
      "max-bytes": { type: "string" },
      links: { type: "boolean" },
      "same-origin": { type: "boolean" },
      raw: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  const { values, positionals } = parsed;
  const command = positionals[0];

  if (values["version"] === true) {
    io.stdout(SERVER_VERSION);
    return 0;
  }
  if (values["help"] === true || command === undefined || command === "help") {
    io.stdout(HELP);
    return 0;
  }

  if (command === "serve") {
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const server = buildServer();
    await server.connect(new StdioServerTransport());
    return 0;
  }

  let url: string | undefined;
  if (command === "snapshot") {
    url = positionals[1];
  } else {
    url = command;
  }
  if (url === undefined) {
    io.stderr("Missing URL. Run mcp-web-snapshot --help for usage.");
    return 2;
  }

  let options: SnapshotOptions;
  try {
    options = {
      budget: parsePositiveInt(values["budget"], "--budget", DEFAULT_BUDGET),
      timeoutMs: parsePositiveInt(values["timeout"], "--timeout", DEFAULT_TIMEOUT_MS),
      maxBytes: parsePositiveInt(values["max-bytes"], "--max-bytes", DEFAULT_MAX_BYTES),
      readability: values["raw"] !== true,
      includeLinks: values["links"] === true,
      sameOriginLinks: values["same-origin"] === true,
    };
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 2;
  }

  try {
    const result = await snapshotUrl(url, options);
    io.stdout(values["json"] === true ? JSON.stringify(result, null, 2) : renderSnapshotText(result));
    return 0;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
