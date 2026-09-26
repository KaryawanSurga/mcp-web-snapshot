import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main, type CliIo } from "../src/cli.js";
import { SnapshotMemory } from "../src/core/memory.js";
import { snapshotUrl } from "../src/core/snapshot.js";

const articleHtml = `<!doctype html><html><head><title>Getting Started with Widgets</title></head><body><main>
  <article id="post">
    <h1>Getting Started with Widgets</h1>
    <p>Widgets are small building blocks. This guide shows how to install and use them in your project, with examples.</p>
    <h2>Installation</h2>
    <p>Run the following command in your terminal and follow the prompts to finish the setup.</p>
    <pre><code>npm install widgets</code></pre>
  </article>
</main></body></html>`;

const restructuredHtml = `<!doctype html><html><head><title>Getting Started with Widgets</title></head><body><div class="landing">
  <div class="story" data-kind="article">
    <h1>Getting Started with Widgets</h1>
    <p>Widgets are small building blocks. This guide shows how to install and use them in your project, with examples.</p>
    <h2>Installation</h2>
    <p>Run the following command in your terminal and follow the prompts to finish the setup.</p>
    <pre><code>npm install widgets</code></pre>
  </div>
</div></body></html>`;

let body = articleHtml;
let server: Server;
let url = "";
let directory = "";
let memoryPath = "";

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "web-snapshot-adaptive-"));
  memoryPath = path.join(directory, "memory.json");
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  url = `http://127.0.0.1:${address.port}/article`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await rm(directory, { recursive: true, force: true });
});

describe("adaptive snapshots", () => {
  it("saves a fingerprint on the first adaptive snapshot", async () => {
    body = articleHtml;
    const result = await snapshotUrl(url, { adaptive: true, memoryPath });

    expect(result.adaptive?.saved).toBe(true);
    expect(result.adaptive?.used).toBe(false);
    expect(result.markdown).toContain("npm install widgets");

    const memory = new SnapshotMemory(memoryPath);
    const entries = memory.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.fingerprint.tag).toBe("article");
  });

  it("keeps the previous extraction when the page is unchanged", async () => {
    body = articleHtml;
    const result = await snapshotUrl(url, { adaptive: true, memoryPath });

    expect(result.adaptive?.used).toBe(false);
    expect(result.adaptive?.score).toBe(100);
  });

  it("recovers content after the structure changes when similarity drops", async () => {
    body = restructuredHtml;
    const result = await snapshotUrl(url, {
      adaptive: true,
      memoryPath,
      similarityThreshold: 70,
    });

    expect(result.adaptive?.used).toBe(true);
    expect(result.adaptive?.score).toBeGreaterThanOrEqual(40);
    expect(result.markdown).toContain("npm install widgets");
  });

  it("can relocate directly from memory with forceAdaptive", async () => {
    body = restructuredHtml;
    const result = await snapshotUrl(url, { adaptive: true, forceAdaptive: true, memoryPath });

    expect(result.adaptive?.used).toBe(true);
    expect(result.markdown).toContain("npm install widgets");
  });

  it("does not write memory unless adaptive is enabled", async () => {
    const dir = path.join(directory, "plain");
    const plainMemory = path.join(dir, "memory.json");
    const result = await snapshotUrl(url, { memoryPath: plainMemory });
    expect(result.adaptive).toBeUndefined();
    expect(new SnapshotMemory(plainMemory).list()).toEqual([]);
  });

  it("works through the cli", async () => {
    const previous = process.env["MCP_WEB_SNAPSHOT_MEMORY"];
    process.env["MCP_WEB_SNAPSHOT_MEMORY"] = path.join(directory, "cli-memory.json");
    let out = "";
    const io: CliIo = {
      stdout: (text) => {
        out += `${text}\n`;
      },
      stderr: () => undefined,
      color: false,
    };
    try {
      const code = await main([url, "--adaptive", "--budget", "600"], io);
      expect(code).toBe(0);
      expect(out).toContain("npm install widgets");
      expect(new SnapshotMemory(process.env["MCP_WEB_SNAPSHOT_MEMORY"]).list()).toHaveLength(1);
    } finally {
      if (previous === undefined) {
        delete process.env["MCP_WEB_SNAPSHOT_MEMORY"];
      } else {
        process.env["MCP_WEB_SNAPSHOT_MEMORY"] = previous;
      }
    }
  });
});
