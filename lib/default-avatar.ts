const INITIALS_AVATAR_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#ff845e", "#d45246"],
  ["#8e85ee", "#5f62d6"],
  ["#5fb2ff", "#3b82f6"],
  ["#67d67c", "#34c759"],
  ["#f7c04a", "#f59e0b"],
  ["#ef6fa8", "#db2777"],
  ["#57c7d4", "#0891b2"],
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeToken(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

export function buildInitials(displayName: string) {
  const normalized = normalizeToken(displayName);
  if (!normalized) return "U";

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  const compact = parts[0] ?? normalized;
  const first = compact[0] ?? "U";
  const second = compact[1] ?? "";
  return `${first}${second}`.toUpperCase();
}

function pickInitialsPalette(displayName: string, link: string) {
  const seedSource = `${normalizeToken(displayName).toLowerCase()}::${link.trim().toLowerCase()}`;
  let hash = 0;
  for (let index = 0; index < seedSource.length; index += 1) {
    hash = (hash * 31 + seedSource.charCodeAt(index)) >>> 0;
  }
  return INITIALS_AVATAR_PALETTE[hash % INITIALS_AVATAR_PALETTE.length]!;
}

export function generateDefaultAvatarDataUrl(displayName: string, link: string) {
  const initials = buildInitials(displayName);
  const [startColor, endColor] = pickInitialsPalette(displayName, link);
  const safeInitials = escapeXml(initials);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none">
  <defs>
    <linearGradient id="bg" x1="40" y1="28" x2="284" y2="300" gradientUnits="userSpaceOnUse">
      <stop stop-color="${startColor}" />
      <stop offset="1" stop-color="${endColor}" />
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="160" fill="url(#bg)" />
  <text
    x="160"
    y="172"
    text-anchor="middle"
    dominant-baseline="middle"
    fill="white"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="118"
    font-weight="700"
    letter-spacing="2"
  >${safeInitials}</text>
</svg>`.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function generateDefaultBannerDataUrl(displayName: string, link: string) {
  const [startColor, endColor] = pickInitialsPalette(displayName, link);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="560" viewBox="0 0 1600 560" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1600" y2="560" gradientUnits="userSpaceOnUse">
      <stop stop-color="${startColor}" stop-opacity="0.9" />
      <stop offset="1" stop-color="${endColor}" stop-opacity="0.95" />
    </linearGradient>
    <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1300 80) rotate(120) scale(540 340)">
      <stop stop-color="white" stop-opacity="0.24" />
      <stop offset="1" stop-color="white" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(320 520) rotate(-20) scale(620 280)">
      <stop stop-color="white" stop-opacity="0.12" />
      <stop offset="1" stop-color="white" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="shade" x1="800" y1="240" x2="800" y2="560" gradientUnits="userSpaceOnUse">
      <stop stop-color="#000000" stop-opacity="0" />
      <stop offset="1" stop-color="#000000" stop-opacity="0.5" />
    </linearGradient>
  </defs>
  <rect width="1600" height="560" rx="0" fill="url(#bg)" />
  <rect width="1600" height="560" fill="url(#glowA)" />
  <rect width="1600" height="560" fill="url(#glowB)" />
  <rect width="1600" height="560" fill="url(#shade)" />
</svg>`.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function tryDecodeSvgDataUrl(value: string) {
  const trimmed = value.trim();
  const prefix = "data:image/svg+xml;charset=UTF-8,";
  if (!trimmed.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(trimmed.slice(prefix.length));
  } catch {
    return null;
  }
}

export function isDefaultAvatarDataUrl(value: string | null | undefined) {
  if (!value) return false;
  const svg = tryDecodeSvgDataUrl(value);
  if (!svg) return false;
  return (
    svg.includes("<linearGradient id=\"bg\"") &&
    svg.includes("<rect width=\"320\" height=\"320\"") &&
    svg.includes("<text") &&
    svg.includes("font-size=\"118\"")
  );
}

export function isDefaultBannerDataUrl(value: string | null | undefined) {
  if (!value) return false;
  const svg = tryDecodeSvgDataUrl(value);
  if (!svg) return false;
  return (
    svg.includes("<linearGradient id=\"bg\"") &&
    svg.includes("<radialGradient id=\"glowA\"") &&
    svg.includes("<radialGradient id=\"glowB\"") &&
    svg.includes("width=\"1600\" height=\"560\"")
  );
}
