# MCP Web Snapshot

[![CI](https://github.com/KaryawanSurga/mcp-web-snapshot/actions/workflows/ci.yml/badge.svg)](https://github.com/KaryawanSurga/mcp-web-snapshot/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Turn any web page into clean, readable markdown for LLM agents.**

MCP Web Snapshot fetches a URL and returns the content an agent actually needs — main article text, headings, lists, code, and resolved links — with navigation, ads, scripts, and styles removed. Use it as an MCP tool or straight from the terminal. Output is capped by an explicit token budget so a single page cannot flood the context window.

Third tool in the TokenSaver family: [TokenSaver MCP](https://github.com/KaryawanSurga/TokenSaverMcp) maps repositories, [MCP Context Budget](https://github.com/KaryawanSurga/mcp-context-budget) audits tool costs, and Web Snapshot reads the web.

> Product requirements: [PRD.md](PRD.md) · [PRD.id.md](PRD.id.md) (Bahasa Indonesia)

## Why

Agents read the web constantly — docs, changelogs, issues, articles. Raw HTML is mostly chrome: menus, cookie banners, scripts, tracking pixels. Feeding that to a model burns tokens and buries the useful text. Web Snapshot extracts the readable content, converts it to markdown, resolves relative links, and trims everything to your budget.

## Quick start

CLI, no install needed:

```sh
npx -y mcp-web-snapshot https://example.com --budget 500
```

Result:

```text
# Example Domain
Source: https://example.com/ | HTTP 200 | 559 bytes | ~38 tokens

This domain is for use in documentation examples without needing permission. Avoid use in operations.

[Learn more](https://iana.org/domains/example)
```

Add `--links` to append the page links, `--json` for machine-readable output, `--raw` to keep the full page structure, or `--same-origin` to filter links to the same host.

## MCP server

Add it to any MCP-compatible client:

```json
{
  "mcpServers": {
    "websnapshot": {
      "command": "npx",
      "args": ["-y", "mcp-web-snapshot", "serve"]
    }
  }
}
```

From a local checkout, point `command` at `node` and `args` at the built entry point:

```json
{
  "mcpServers": {
    "websnapshot": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-web-snapshot/dist/index.js", "serve"]
    }
  }
}
```

## Tools

| Tool | What it returns |
| --- | --- |
| `snapshot` | Clean markdown of a page: title, source metadata, readable content, optional links, token count, truncation flag, and adaptive memory recovery when enabled. |
| `extract_links` | Deduplicated absolute links with anchor text, optionally same-origin only. |

Both tools accept an optional `timeoutMs`. `snapshot` also accepts `budget`, `readability`, `links`, and `adaptive`.

## How it works

1. **Fetch** with a timeout, a size cap, and a descriptive user agent.
2. **Validate** the response: status, content type, and declared size.
3. **Extract** the main content with Mozilla Readability, falling back to the cleaned page body when there is no article.
4. **Convert** to markdown with Turndown, resolving relative links and images against the final URL.
5. **Trim** to the token budget, reporting truncation explicitly.

Token counts are estimated at four characters per token so the conversion stays fully offline and deterministic.

## Adaptive extraction

Pages get redesigned and extraction breaks. With `--adaptive`, Snapshot remembers the structure of the pages you care about and recovers the content after a redesign — no AI involved.

1. The first adaptive snapshot stores a fingerprint of the content container (tag, id, classes, attributes, path, parent, and a text hash) in `~/.mcp-web-snapshot/memory.json`.
2. Every later adaptive snapshot compares the page against the stored fingerprint.
3. When similarity drops below the threshold (default 40%), Snapshot scores every element on the page and relocates the closest match.

```sh
npx -y mcp-web-snapshot https://docs.example.com/guide --adaptive
```

Memory is local-only, scoped per domain, and capped at 50 pages per domain. Point `--memory <path>` or `MCP_WEB_SNAPSHOT_MEMORY` at a different file for a shared or throwaway store. The technique is inspired by [Scrapling](https://github.com/D4Vinci/Scrapling)'s adaptive scraping, reimplemented for this tool.

## Design principles

- **Bounded**: request timeouts, a 2 MB download cap, and a token budget on every response.
- **Predictable**: same page, same output; nothing beyond the requested URL is fetched.
- **Safe by default**: only `http` and `https` are allowed; no cookies, no credentials, no JavaScript execution.
- **Read-only**: never writes anything anywhere.
- **Honest**: truncation and size caps are reported in the output.

## CLI reference

```text
mcp-web-snapshot <url> [options]
mcp-web-snapshot snapshot <url> [options]
mcp-web-snapshot serve
```

| Option | Meaning |
| --- | --- |
| `--budget <tokens>` | Approximate token budget (default 4000) |
| `--timeout <ms>` | Request timeout (default 15000) |
| `--max-bytes <n>` | Maximum download size (default 2000000) |
| `--links` | Append page links |
| `--same-origin` | With `--links`, keep only same-origin links |
| `--adaptive` | Remember page structure and recover content after redesigns |
| `--memory <path>` | Memory file for `--adaptive` (default `~/.mcp-web-snapshot/memory.json`) |
| `--raw` | Skip readability and keep the full page structure |
| `--json` | Machine-readable output |

Exit codes: `0` success, `1` fetch or parse failure, `2` usage error.

## Roadmap

- Adaptive extraction for pages without semantic containers (`article` / `main`).
- Local response cache with TTL.
- PDF and plain-text document handling.
- `robots.txt` awareness and per-host rate limiting.
- Batch snapshots for reading lists.
- Exact tokenizer mode for precise budgets.

## Development

```sh
npm install
npm run typecheck
npm run build
npm test
```

The suite runs entirely against local HTTP fixtures: extraction, markdown conversion, link resolution, budgeting, timeouts, size caps, CLI behavior, and MCP round trips.

## License

MIT — see [LICENSE](LICENSE).
