import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main, type CliIo } from "../src/cli.js";
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

function makeIo(): { io: CliIo; out: () => string; err: () => string } {
  let out = "";
  let err = "";
  return {
    io: {
      stdout: (text) => {
        out += `${text}\n`;
      },
      stderr: (text) => {
        err += `${text}\n`;
      },
      color: false,
    },
    out: () => out,
    err: () => err,
  };
}

describe("cli", () => {
  it("prints the version", async () => {
    const { io, out } = makeIo();
    expect(await main(["--version"], io)).toBe(0);
    expect(out()).toContain("0.1.0");
  });

  it("prints help when called without arguments", async () => {
    const { io, out } = makeIo();
    expect(await main([], io)).toBe(0);
    expect(out()).toContain("Usage:");
  });

  it("rejects a missing url and bad flag values", async () => {
    const missing = makeIo();
    expect(await main(["snapshot"], missing.io)).toBe(2);
    expect(missing.err()).toContain("Missing URL");

    const badBudget = makeIo();
    expect(await main([`${server.url}/article`, "--budget", "abc"], badBudget.io)).toBe(2);
    expect(badBudget.err()).toContain("--budget must be a positive integer");
  });

  it("snapshots a url as json", async () => {
    const { io, out } = makeIo();
    const code = await main([`${server.url}/article`, "--json", "--budget", "2000"], io);
    expect(code).toBe(0);
    const result = JSON.parse(out()) as { markdown: string; tokens: number; status: number };
    expect(result.markdown).toContain("npm install widgets");
    expect(result.tokens).toBeGreaterThan(10);
    expect(result.status).toBe(200);
  });

  it("supports the explicit snapshot command with links", async () => {
    const { io, out } = makeIo();
    const code = await main(["snapshot", `${server.url}/article`, "--links", "--same-origin"], io);
    expect(code).toBe(0);
    expect(out()).toContain("## Links");
  });

  it("exits 1 on fetch errors", async () => {
    const { io, err } = makeIo();
    const code = await main([`${server.url}/missing-page`], io);
    expect(code).toBe(1);
    expect(err()).toContain("HTTP 404");
  });
});
