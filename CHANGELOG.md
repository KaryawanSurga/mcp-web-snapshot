# Changelog

All notable changes to MCP Web Snapshot are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-19

### Added

- `snapshot` tool and CLI command: fetch a URL and return clean, readable markdown.
- Readability-based main content extraction with a full-page fallback for non-article pages.
- Turndown-based HTML to markdown conversion with absolute link resolution.
- `extract_links` tool for collecting page links, optionally same-origin only.
- Token budget trimming with explicit truncation reporting.
- Download size caps, content-type validation, and request timeouts.
- `serve` mode exposing the tools over MCP stdio.
- Unit, integration, and MCP round-trip test coverage.

[0.1.0]: https://github.com/KaryawanSurga/mcp-web-snapshot/releases/tag/v0.1.0
