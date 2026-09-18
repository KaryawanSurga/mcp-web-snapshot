import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPage } from "./core/fetch.js";
import { extractLinks } from "./core/links.js";
import { renderSnapshotText, snapshotUrl } from "./core/snapshot.js";

export const SERVER_NAME = "mcp-web-snapshot";
export const SERVER_VERSION = "0.1.0";

export const snapshotSchema = {
  url: z.string().describe("Absolute http(s) URL to snapshot"),
  budget: z
    .number()
    .int()
    .min(200)
    .max(50000)
    .optional()
    .describe("Approximate token budget for the returned markdown (default 4000)"),
  readability: z.boolean().optional().describe("Extract the main article content only (default true)"),
  links: z.boolean().optional().describe("Include the page links at the end of the output"),
  timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds (default 15000)"),
};

export const linksSchema = {
  url: z.string().describe("Absolute http(s) URL to scan for links"),
  sameOriginOnly: z.boolean().optional().describe("Only return links on the same origin (default false)"),
  limit: z.number().int().min(1).max(1000).optional().describe("Maximum links to return (default 200)"),
  timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds (default 15000)"),
};

export function buildServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "snapshot",
    {
      title: "Web snapshot",
      description:
        "Fetch a web page and return clean, readable markdown with navigation, ads, and scripts removed. Use it to read " +
        "documentation, articles, and release notes without flooding the context with raw HTML. Output honors a token budget.",
      inputSchema: snapshotSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ url, budget, readability, links, timeoutMs }) => {
      try {
        const options: Parameters<typeof snapshotUrl>[1] = {};
        if (budget !== undefined) {
          options.budget = budget;
        }
        if (readability !== undefined) {
          options.readability = readability;
        }
        if (links !== undefined) {
          options.includeLinks = links;
        }
        if (timeoutMs !== undefined) {
          options.timeoutMs = timeoutMs;
        }
        const result = await snapshotUrl(url, options);
        return { content: [{ type: "text", text: renderSnapshotText(result) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: `snapshot failed: ${message}` }] };
      }
    },
  );

  server.registerTool(
    "extract_links",
    {
      title: "Extract links",
      description:
        "Fetch a web page and return its links as a deduplicated list of absolute URLs with anchor text. Useful for " +
        "crawling a documentation site, finding related pages, or building a reading queue.",
      inputSchema: linksSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ url, sameOriginOnly, limit, timeoutMs }) => {
      try {
        const fetched = await fetchPage(url, timeoutMs !== undefined ? { timeoutMs } : {});
        const links = extractLinks(fetched.body, fetched.finalUrl, {
          sameOriginOnly: sameOriginOnly === true,
          ...(limit !== undefined ? { limit } : {}),
        });
        if (links.length === 0) {
          return { content: [{ type: "text", text: `No links found on ${fetched.finalUrl}` }] };
        }
        const lines = links.map((link) => `- [${link.text.length > 0 ? link.text : link.url}](${link.url})`);
        return {
          content: [{ type: "text", text: [`# ${links.length} link(s) on ${fetched.finalUrl}`, ...lines].join("\n") }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: `extract_links failed: ${message}` }] };
      }
    },
  );

  return server;
}
