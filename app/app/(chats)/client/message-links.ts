"use client";

import { type MessageTextSegment } from "../types";

export const MESSAGE_LINK_RE = /((?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s]*)?)/giu;

export const LINK_TRAILING_PUNCT_RE = /[),.!?:;]+$/u;

export const TRUSTED_LINK_DOMAINS = new Set(["eclpse.ru", "eclpse.online"]);

export const PUBLIC_LINK_RE = /^[a-z0-9_]{2,32}$/iu;

export function normalizeExternalUrl(value: string) {
  if (/^https?:\/\//iu.test(value)) return value;
  return `https://${value}`;
}

export function isTrustedLinkHost(hostname: string) {
  const host = hostname.toLowerCase();
  for (const trusted of TRUSTED_LINK_DOMAINS) {
    if (host === trusted || host.endsWith(`.${trusted}`)) return true;
  }
  return false;
}

export function isLikelyPublicLink(link?: string | null) {
  if (!link) return false;
  return PUBLIC_LINK_RE.test(link);
}

export function splitMessageTextSegments(value: string): MessageTextSegment[] {
  if (!value) return [{ kind: "text", text: "" }];
  const segments: MessageTextSegment[] = [];
  const candidates: Array<{ index: number; raw: string; kind: "url" }> = [];
  for (const match of value.matchAll(MESSAGE_LINK_RE)) {
    const index = match.index ?? -1;
    const raw = match[0] ?? "";
    if (index >= 0 && raw) candidates.push({ index, raw, kind: "url" });
  }
  candidates.sort((a, b) => a.index - b.index);
  let cursor = 0;
  for (const candidate of candidates) {
    const index = candidate.index;
    const full = candidate.raw;
    if (index < cursor) continue;
    if (index > cursor) {
      segments.push({ kind: "text", text: value.slice(cursor, index) });
    }
    let tokenText = full;
    const trailing = tokenText.match(LINK_TRAILING_PUNCT_RE)?.[0] ?? "";
    if (trailing) {
      tokenText = tokenText.slice(0, -trailing.length);
    }
    if (tokenText) {
      segments.push({ kind: "url", text: tokenText, url: normalizeExternalUrl(tokenText) });
    }
    if (trailing) {
      segments.push({ kind: "text", text: trailing });
    }
    cursor = index + full.length;
  }
  if (cursor < value.length) {
    segments.push({ kind: "text", text: value.slice(cursor) });
  }
  return segments.length > 0 ? segments : [{ kind: "text", text: value }];
}
