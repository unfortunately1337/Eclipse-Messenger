/**
 * Cybersecurity hardening: Safe URL validation and XSS prevention utilities.
 */

const DANGEROUS_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "about:",
]);

/**
 * Checks if a given URL has a safe web protocol (http: or https: or relative).
 */
export function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim().toLowerCase();

  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(protocol)) {
      return false;
    }
  }

  // Allow relative URLs
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }

  // Check valid absolute URLs
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "tg:" || parsed.protocol === "mailto:";
  } catch {
    // If it's a domain-like string (e.g. google.com), consider safe if it has no dangerous schemes
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
      return true;
    }
    return false;
  }
}

/**
 * Normalizes an external URL safely, adding https:// if missing.
 */
export function sanitizeExternalUrl(rawUrl: string): string | null {
  if (!isSafeUrl(rawUrl)) return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Extracts a clean hostname for safe display in confirmation dialogs.
 */
export function getSafeHostname(rawUrl: string): string {
  try {
    const sanitized = sanitizeExternalUrl(rawUrl);
    if (!sanitized) return "внешний сайт";
    const url = new URL(sanitized);
    return url.hostname || url.host || "внешний сайт";
  } catch {
    return "внешний сайт";
  }
}
