import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ElementFingerprint } from "./fingerprint.js";

export interface MemoryEntry {
  key: string;
  url: string;
  savedAt: string;
  fingerprint: ElementFingerprint;
}

interface MemoryFile {
  version: 1;
  domains: Record<string, MemoryEntry[]>;
}

export const MAX_ENTRIES_PER_DOMAIN = 50;

export function defaultMemoryPath(): string {
  const override = process.env["MCP_WEB_SNAPSHOT_MEMORY"];
  if (override !== undefined && override.length > 0) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), ".mcp-web-snapshot", "memory.json");
}

export function memoryKeyOf(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export class SnapshotMemory {
  readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? defaultMemoryPath();
  }

  private load(): MemoryFile {
    if (!existsSync(this.filePath)) {
      return { version: 1, domains: {} };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as MemoryFile;
      if (parsed === null || typeof parsed !== "object" || typeof parsed.domains !== "object") {
        return { version: 1, domains: {} };
      }
      return { version: 1, domains: parsed.domains ?? {} };
    } catch {
      return { version: 1, domains: {} };
    }
  }

  private persist(data: MemoryFile): void {
    try {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    } catch {
      return;
    }
  }

  remember(domain: string, entry: { key: string; url: string; fingerprint: ElementFingerprint }): void {
    const data = this.load();
    const entries = (data.domains[domain] ?? []).filter((existing) => existing.key !== entry.key);
    entries.push({
      key: entry.key,
      url: entry.url,
      savedAt: new Date().toISOString(),
      fingerprint: entry.fingerprint,
    });
    data.domains[domain] = entries.slice(-MAX_ENTRIES_PER_DOMAIN);
    this.persist(data);
  }

  recall(domain: string, key: string): MemoryEntry | undefined {
    const entries = this.load().domains[domain] ?? [];
    return entries.find((entry) => entry.key === key);
  }

  forget(domain: string, key?: string): number {
    const data = this.load();
    const entries = data.domains[domain] ?? [];
    const kept = key === undefined ? [] : entries.filter((entry) => entry.key !== key);
    const removed = entries.length - kept.length;
    if (removed > 0) {
      if (kept.length > 0) {
        data.domains[domain] = kept;
      } else {
        delete data.domains[domain];
      }
      this.persist(data);
    }
    return removed;
  }

  list(domain?: string): MemoryEntry[] {
    const data = this.load();
    if (domain !== undefined) {
      return data.domains[domain] ?? [];
    }
    return Object.values(data.domains).flat();
  }
}
