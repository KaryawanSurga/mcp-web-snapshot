# PRD — MCP Web Snapshot

**Status:** v0.2.0 ready to ship
**Owner:** KaryawanSurga
**Last updated:** 2026-09-26

## 1. Summary

MCP Web Snapshot is an MCP server and CLI that fetch a web page and return clean, readable markdown for LLM agents: main content extracted, chrome removed, links resolved, output trimmed to a token budget. It exists so agents can read the web without flooding their context with raw HTML.

## 2. Problem

- Agents read documentation, articles, issues, and changelogs constantly.
- Raw HTML is mostly chrome: navigation, ads, scripts, cookie banners, tracking markup.
- Feeding raw pages to a model wastes tokens, money, and attention, and buries the actual content.
- Ad-hoc scraping scripts are duplicated in every agent project and rarely handle timeouts, size caps, or content types.

## 3. Target users

- Developers whose agents research documentation and web sources.
- Agent builders who need a reliable web-reading primitive.
- Teams watching context cost per session.

## 4. Goals (v0.1.0)

1. One call (or one command) turns a URL into clean markdown.
2. Main content extraction with a predictable fallback for non-article pages.
3. Absolute link resolution and optional link extraction.
4. Explicit token budgeting with truncation reporting.
5. Safe fetching: timeouts, size caps, content-type validation, http/https only.
6. Fully offline processing — the only network activity is the requested page fetch.

## 5. Non-goals

- JavaScript rendering; v0.1.0 reads server-rendered HTML only.
- Crawling, sitemap walking, or site-wide scraping.
- Browser sessions, cookies, authentication, or paywall bypass.
- PDF, image, or binary document parsing in v0.1.0.
- Search engines or content discovery.

## 6. User stories

- As an agent, I want to read a documentation page as markdown so I don't waste tokens on HTML.
- As a developer, I want to snapshot a changelog or release notes in one CLI call.
- As an agent, I want the links on a page so I can decide where to read next.
- As a team lead, I want page reads to be bounded by a budget instead of unbounded dumps.

## 7. Functional requirements

| ID | Requirement |
| --- | --- |
| FR1 | `snapshot` fetches a URL and returns title, source metadata, markdown, token count, and truncation status. |
| FR2 | Main content extraction uses Mozilla Readability with a full-page fallback. |
| FR3 | HTML is converted to markdown with relative links and images resolved against the final URL. |
| FR4 | `extract_links` returns deduplicated absolute links with text, optionally same-origin only. |
| FR5 | `--budget` trims output and reports truncation explicitly. |
| FR6 | Requests enforce a timeout and a maximum download size. |
| FR7 | Only `http` and `https` URLs are accepted. |
| FR8 | `serve` exposes both tools over MCP stdio. |
| FR9 | Non-HTML text responses are returned as-is, trimmed only by budget. |
| FR10 | `--adaptive` fingerprints the content container locally and recovers it via similarity scoring when a page is redesigned; memory is per-domain, capped, and never leaves the machine. |

## 8. Non-functional requirements

- Deterministic extraction for the same page and options.
- No cookies, credentials, JavaScript execution, or telemetry.
- Node >= 20; runtime dependencies limited to the MCP SDK, readability, linkedom, turndown, and zod.
- All fetch paths time out; no hung requests.
- Tests run fully offline against local HTTP fixtures.

## 9. Success metrics

- Users replace ad-hoc scraping scripts with the tool.
- Adoption in public MCP configs and agent dotfiles.
- npm installs and GitHub stars growing week over week.
- Feature requests for cache and PDF support (signals of real use).

## 10. Technical notes

- `@mozilla/readability` on a linkedom DOM avoids a heavyweight jsdom dependency.
- Turndown rules resolve links and images and drop `javascript:` URLs.
- Body reads are capped by content-length when declared and by slicing when chunked.
- Token estimates use four characters per token; exact mode is a roadmap item.

## 11. Release plan

- **v0.1.0** — snapshot, extract_links, budgeting, CLI, MCP server, CI (shipped 2026-09-19).
- **v0.2.0** — adaptive extraction: content fingerprints, local memory, similarity-based recovery after redesigns (shipped 2026-09-20).
- **v0.3.0** — local cache with TTL, robots-aware politeness, semantic-container detection for adaptive extraction.
- **v0.4.0** — PDF/text documents, batch snapshots, exact tokenizer mode.

## 12. Open questions

- Is 4000 tokens the right default budget?
- Should caching be opt-in or default with TTL?
- Should `extract_links` offer depth-1 crawling?
