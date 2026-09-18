import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { fixture, startTestServer, type TestServer } from "./helpers/http-server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer({
    "/article": { body: fixture("article.html") },
  });
});

afterAll(async () => {
  await server.close();
});

interface TextBlock {
  type: string;
  text?: string;
}

function firstText(result: { content: unknown[] }): string {
  const block = result.content.find((entry) => (entry as TextBlock).type === "text") as TextBlock | undefined;
  return block?.text ?? "";
}

async function connectClient(): Promise<Client> {
  const mcp = buildServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "web-snapshot-test", version: "0.0.0" });
  await mcp.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe("web snapshot mcp server", () => {
  it("advertises its tools", async () => {
    const client = await connectClient();
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual(["extract_links", "snapshot"]);
      for (const tool of tools) {
        expect(tool.description ?? "").not.toBe("");
      }
    } finally {
      await client.close();
    }
  });

  it("snapshots a page", async () => {
    const client = await connectClient();
    try {
      const result = await client.callTool({
        name: "snapshot",
        arguments: { url: `${server.url}/article`, budget: 2000 },
      });
      const text = firstText(result as { content: unknown[] });
      expect(text).toContain("Getting Started");
      expect(text).toContain("npm install widgets");
      expect(text).toContain("Source:");
    } finally {
      await client.close();
    }
  });

  it("extracts links", async () => {
    const client = await connectClient();
    try {
      const result = await client.callTool({
        name: "extract_links",
        arguments: { url: `${server.url}/article`, sameOriginOnly: true },
      });
      const text = firstText(result as { content: unknown[] });
      expect(text).toContain("link(s) on");
      expect(text).toContain("/docs");
    } finally {
      await client.close();
    }
  });

  it("returns tool errors for invalid urls", async () => {
    const client = await connectClient();
    try {
      const result = await client.callTool({ name: "snapshot", arguments: { url: "not-a-url" } });
      expect(result.isError).toBe(true);
      expect(firstText(result as { content: unknown[] })).toContain("snapshot failed");
    } finally {
      await client.close();
    }
  });
});
