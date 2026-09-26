import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultMemoryPath,
  domainOf,
  MAX_ENTRIES_PER_DOMAIN,
  memoryKeyOf,
  SnapshotMemory,
} from "../src/core/memory.js";
import type { ElementFingerprint } from "../src/core/fingerprint.js";

function fakeFingerprint(text: string): ElementFingerprint {
  return {
    tag: "article",
    classes: [],
    attributes: [],
    path: ["html", "body"],
    textHash: text,
    textLength: text.length,
  };
}

async function makeTempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "web-snapshot-memory-"));
}

describe("memory helpers", () => {
  it("names keys without fragments", () => {
    expect(memoryKeyOf("https://example.com/a#section")).toBe("https://example.com/a");
    expect(memoryKeyOf("not a url")).toBe("not a url");
  });

  it("extracts domains", () => {
    expect(domainOf("https://docs.example.com/page")).toBe("docs.example.com");
    expect(domainOf("nonsense")).toBe("unknown");
  });

  it("uses the environment override for the default path", () => {
    const previous = process.env["MCP_WEB_SNAPSHOT_MEMORY"];
    process.env["MCP_WEB_SNAPSHOT_MEMORY"] = "custom/memory.json";
    try {
      expect(defaultMemoryPath()).toBe(path.resolve("custom/memory.json"));
    } finally {
      if (previous === undefined) {
        delete process.env["MCP_WEB_SNAPSHOT_MEMORY"];
      } else {
        process.env["MCP_WEB_SNAPSHOT_MEMORY"] = previous;
      }
    }
  });
});

describe("SnapshotMemory", () => {
  it("remembers and recalls per domain", async () => {
    const dir = await makeTempDir();
    try {
      const memory = new SnapshotMemory(path.join(dir, "memory.json"));
      memory.remember("example.com", { key: "https://example.com/a", url: "https://example.com/a", fingerprint: fakeFingerprint("one") });
      memory.remember("other.com", { key: "https://other.com/b", url: "https://other.com/b", fingerprint: fakeFingerprint("two") });

      expect(memory.recall("example.com", "https://example.com/a")?.fingerprint.textHash).toBe("one");
      expect(memory.recall("other.com", "https://other.com/b")?.fingerprint.textHash).toBe("two");
      expect(memory.recall("other.com", "https://example.com/a")).toBeUndefined();
      expect(memory.list()).toHaveLength(2);
      expect(memory.list("example.com")).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("updates the same key instead of duplicating it", async () => {
    const dir = await makeTempDir();
    try {
      const memory = new SnapshotMemory(path.join(dir, "memory.json"));
      memory.remember("example.com", { key: "k", url: "u", fingerprint: fakeFingerprint("v1") });
      memory.remember("example.com", { key: "k", url: "u", fingerprint: fakeFingerprint("v2") });
      expect(memory.list("example.com")).toHaveLength(1);
      expect(memory.recall("example.com", "k")?.fingerprint.textHash).toBe("v2");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("caps entries per domain", async () => {
    const dir = await makeTempDir();
    try {
      const memory = new SnapshotMemory(path.join(dir, "memory.json"));
      for (let index = 0; index < MAX_ENTRIES_PER_DOMAIN + 10; index += 1) {
        memory.remember("example.com", { key: `k${index}`, url: "u", fingerprint: fakeFingerprint(`v${index}`) });
      }
      const entries = memory.list("example.com");
      expect(entries).toHaveLength(MAX_ENTRIES_PER_DOMAIN);
      expect(entries[0]?.key).toBe("k10");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("forgets entries", async () => {
    const dir = await makeTempDir();
    try {
      const memory = new SnapshotMemory(path.join(dir, "memory.json"));
      memory.remember("example.com", { key: "a", url: "u", fingerprint: fakeFingerprint("a") });
      memory.remember("example.com", { key: "b", url: "u", fingerprint: fakeFingerprint("b") });
      expect(memory.forget("example.com", "a")).toBe(1);
      expect(memory.recall("example.com", "a")).toBeUndefined();
      expect(memory.forget("example.com")).toBe(1);
      expect(memory.list("example.com")).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("tolerates missing and corrupted files", async () => {
    const dir = await makeTempDir();
    try {
      const file = path.join(dir, "memory.json");
      const memory = new SnapshotMemory(file);
      expect(memory.recall("example.com", "k")).toBeUndefined();

      await writeFile(file, "{ not json", "utf8");
      expect(memory.recall("example.com", "k")).toBeUndefined();

      memory.remember("example.com", { key: "k", url: "u", fingerprint: fakeFingerprint("v") });
      expect(memory.recall("example.com", "k")).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
