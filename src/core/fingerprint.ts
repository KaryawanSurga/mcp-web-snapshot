import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";

export interface ElementFingerprint {
  tag: string;
  id?: string;
  classes: string[];
  attributes: string[];
  path: string[];
  parentTag?: string;
  parentId?: string;
  parentClasses?: string[];
  textHash: string;
  textLength: number;
}

interface FingerprintableElement {
  tagName?: string;
  textContent?: string | null;
  parentElement?: FingerprintableElement | null;
  getAttribute: (name: string) => string | null;
  attributes?: ArrayLike<{ name: string; value: string }>;
}

export interface RelocationResult {
  html?: string;
  score: number;
  tag?: string;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 40;
export const MIN_CONTENT_TEXT_LENGTH = 200;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function classesOf(element: FingerprintableElement): string[] {
  return (element.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter((name) => name.length > 0)
    .sort();
}

export function fingerprintElement(element: FingerprintableElement): ElementFingerprint {
  const tag = (element.tagName ?? "").toLowerCase();
  const id = element.getAttribute("id");

  const attributes: string[] = [];
  if (element.attributes !== undefined) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name === "class" || attribute.name === "id") {
        continue;
      }
      attributes.push(`${attribute.name}=${attribute.value}`);
    }
  }
  attributes.sort();

  const path: string[] = [];
  let ancestor = element.parentElement ?? null;
  while (ancestor !== null && path.length < 6) {
    const name = (ancestor.tagName ?? "").toLowerCase();
    if (name.length > 0) {
      path.unshift(name);
    }
    ancestor = ancestor.parentElement ?? null;
  }

  const text = normalizeText(element.textContent ?? "");
  const fingerprint: ElementFingerprint = {
    tag,
    classes: classesOf(element),
    attributes,
    path,
    textHash: createHash("sha1").update(text.slice(0, 2000)).digest("hex"),
    textLength: text.length,
  };
  if (id !== null && id.length > 0) {
    fingerprint.id = id;
  }

  const parent = element.parentElement;
  if (parent !== undefined && parent !== null) {
    fingerprint.parentTag = (parent.tagName ?? "").toLowerCase();
    const parentId = parent.getAttribute("id");
    if (parentId !== null && parentId.length > 0) {
      fingerprint.parentId = parentId;
    }
    const parentClasses = classesOf(parent);
    if (parentClasses.length > 0) {
      fingerprint.parentClasses = parentClasses;
    }
  }

  return fingerprint;
}

function jaccard(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  }
  const union = leftSet.size + rightSet.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function pathSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }
  let index = 0;
  while (
    index < left.length &&
    index < right.length &&
    left[left.length - 1 - index] === right[right.length - 1 - index]
  ) {
    index += 1;
  }
  return index / Math.max(left.length, right.length);
}

export function similarity(left: ElementFingerprint, right: ElementFingerprint): number {
  let score = 0;

  score += left.tag === right.tag ? 20 : 0;

  if (left.id !== undefined && right.id !== undefined) {
    score += left.id === right.id ? 20 : 0;
  } else if (left.id === undefined && right.id === undefined) {
    score += 10;
  }

  score += jaccard(left.classes, right.classes) * 20;
  score += jaccard(left.attributes, right.attributes) * 15;
  score += pathSimilarity(left.path, right.path) * 15;

  if (left.parentTag !== undefined && left.parentTag === right.parentTag) {
    score += 5;
  }
  if (left.parentId !== undefined && left.parentId === right.parentId) {
    score += 5;
  }
  if (left.textHash === right.textHash) {
    score += 10;
  }

  return Math.round(Math.min(100, score));
}

function parseDocument(html: string): { document: ReturnType<typeof parseHTML>["document"] } {
  const { document } = parseHTML(html);
  return { document };
}

export function findContentRoot(html: string): string | undefined {
  const { document } = parseDocument(html);
  for (const selector of ["article", "main", "[role=main]"]) {
    const candidate = document.querySelector(selector);
    if (candidate !== null && normalizeText(candidate.textContent ?? "").length >= MIN_CONTENT_TEXT_LENGTH) {
      return (candidate as unknown as { outerHTML?: string }).outerHTML;
    }
  }

  const body = document.querySelector("body");
  if (body !== null && normalizeText(body.textContent ?? "").length >= MIN_CONTENT_TEXT_LENGTH) {
    return (body as unknown as { outerHTML?: string }).outerHTML;
  }
  return undefined;
}

export function fingerprintHtmlContent(html: string): ElementFingerprint | undefined {
  const { document } = parseDocument(html);
  const body = document.querySelector("body");
  const root = body?.firstElementChild ?? body;
  if (root === null || root === undefined) {
    return undefined;
  }
  return fingerprintElement(root as unknown as FingerprintableElement);
}

function contentElementOf(document: ReturnType<typeof parseHTML>["document"]): FingerprintableElement | undefined {
  const body = document.querySelector("body");
  if (body !== null && body.firstElementChild !== null) {
    return body.firstElementChild as unknown as FingerprintableElement;
  }
  const documentElement = document.documentElement;
  if (documentElement !== null && (documentElement.tagName ?? "").toLowerCase() !== "html") {
    return documentElement as unknown as FingerprintableElement;
  }
  if (body !== null) {
    return body as unknown as FingerprintableElement;
  }
  return undefined;
}

export function fingerprintContentRoot(html: string): ElementFingerprint | undefined {
  const root = findContentRoot(html);
  if (root === undefined) {
    return undefined;
  }
  const { document } = parseDocument(root);
  const element = contentElementOf(document);
  if (element === undefined) {
    return undefined;
  }
  return fingerprintElement(element);
}

export function relocateContent(
  html: string,
  target: ElementFingerprint,
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): RelocationResult {
  const { document } = parseDocument(html);
  let bestElement: FingerprintableElement | undefined;
  let bestScore = 0;

  for (const element of document.querySelectorAll("*")) {
    const score = similarity(target, fingerprintElement(element as unknown as FingerprintableElement));
    if (score > bestScore) {
      bestScore = score;
      bestElement = element as unknown as FingerprintableElement;
    }
  }

  if (bestElement !== undefined && bestScore >= threshold) {
    const htmlOut = (bestElement as unknown as { outerHTML?: string }).outerHTML ?? "";
    const result: RelocationResult = { html: htmlOut, score: bestScore };
    const tag = (bestElement.tagName ?? "").toLowerCase();
    if (tag.length > 0) {
      result.tag = tag;
    }
    return result;
  }

  return { score: bestScore };
}
