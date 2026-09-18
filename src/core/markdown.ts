import TurndownService from "turndown";

interface AttributeNode {
  getAttribute: (name: string) => string | null;
  textContent?: string | null;
  alt?: string | null;
}

function resolveUrl(raw: string | null, baseUrl: string | undefined): string | undefined {
  if (raw === null || raw.trim().length === 0) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:")) {
    return undefined;
  }
  if (baseUrl === undefined) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

function collapseBlankLines(text: string): string {
  return `${text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function htmlToMarkdown(html: string, baseUrl?: string): string {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });
  service.remove(["script", "style", "noscript", "template", "iframe"]);

  if (baseUrl !== undefined) {
    service.addRule("absoluteLinks", {
      filter: "a",
      replacement: (content, node) => {
        const anchor = node as unknown as AttributeNode;
        const href = resolveUrl(anchor.getAttribute("href"), baseUrl);
        const text = content.trim();
        if (href === undefined) {
          return text;
        }
        if (text.length === 0) {
          return `<${href}>`;
        }
        return `[${text}](${href})`;
      },
    });

    service.addRule("absoluteImages", {
      filter: "img",
      replacement: (_content, node) => {
        const image = node as unknown as AttributeNode;
        const src = resolveUrl(image.getAttribute("src"), baseUrl);
        if (src === undefined) {
          return "";
        }
        const alt = (image.getAttribute("alt") ?? "").trim();
        return `![${alt}](${src})`;
      },
    });
  }

  const markdown = service.turndown(html);
  return collapseBlankLines(markdown);
}
