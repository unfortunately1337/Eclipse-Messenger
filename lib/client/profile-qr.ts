import { communityUrl, profileChatUrl } from "./deployment-url";

export const PROFILE_QR_BACKGROUNDS = [
  { name: "Графит", colors: ["#16191b", "#34383b", "#202426"] },
  { name: "Сланец", colors: ["#20282d", "#46545a", "#242b30"] },
  { name: "Полночь", colors: ["#1c253b", "#475c81", "#222c48"] },
  { name: "Серебро", colors: ["#383e48", "#68727f", "#343c49"] },
  { name: "Роза", colors: ["#422533", "#895169", "#392732"] },
  { name: "Коралл", colors: ["#592a2b", "#a25c53", "#492a30"] },
  { name: "Закат", colors: ["#64351f", "#a86d3d", "#57372b"] },
  { name: "Янтарь", colors: ["#5b401f", "#a08345", "#49351e"] },
  { name: "Оливковый", colors: ["#2d3521", "#586a3e", "#26341f"] },
  { name: "Изумруд", colors: ["#15392e", "#356955", "#142d26"] },
  { name: "Мята", colors: ["#1c433e", "#4b7e69", "#1d3531"] },
  { name: "Бирюза", colors: ["#183d43", "#387983", "#1c333d"] },
  { name: "Океан", colors: ["#1b3552", "#386a84", "#202f4a"] },
  { name: "Лаванда", colors: ["#302d4c", "#6b6288", "#322842"] },
  { name: "Фиолетовый", colors: ["#3c2947", "#6e4e7e", "#322436"] },
  { name: "Персик", colors: ["#503d35", "#8e6e5a", "#46362f"] },
] as const;
export type ProfileQrBackground = (typeof PROFILE_QR_BACKGROUNDS)[number];
export const profileQrBackground = (background: ProfileQrBackground) =>
  `radial-gradient(ellipse at 28% 24%,${background.colors[1]},transparent 65%),linear-gradient(145deg,${background.colors[0]},${background.colors[2]})`;

export function profileQrUrl(username: string, kind?: "group" | "channel", origin?: string) {
  return kind ? communityUrl(username, kind, origin) : profileChatUrl(username, origin);
}

/** Accept profiles and invitations, never arbitrary origins or API/action URLs. */
export function parseProfileQrUrl(raw: string, origin: string): string | null {
  try {
    if (!raw.trim() || raw.includes("\\")) return null;
    const url = new URL(raw.trim(), origin);
    if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) return null;
    if (url.origin !== origin && url.origin !== "https://eclpse.ru") return null;
    if (url.pathname === "/app" && /^[\w-]{1,96}$/u.test(url.searchParams.get("chat") ?? "")) {
      const kind = url.searchParams.get("chatType");
      if (kind && !["direct", "group", "channel", "eclipse"].includes(kind)) return null;
      return url.href;
    }
    if (/^\/invite\/[a-zA-Z0-9_-]+\/?$/u.test(url.pathname) || /^\/app\/[a-zA-Z0-9_]+\/?$/u.test(url.pathname)) return url.href;
  } catch { /* Malformed/unrelated code. */ }
  return null;
}

export { drawQrCode as drawProfileQr } from "./qr-code";

export async function exportProfileQr(code: HTMLCanvasElement, label: string, background: ProfileQrBackground): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1440);
  background.colors.forEach((color, index) => gradient.addColorStop(index / 2, color));
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(120, 260, 840, 920, 96); ctx.fill();
  ctx.drawImage(code, 155, 285, 770, 770);
  try { await document.fonts.ready; } catch { /* Use system font if necessary. */ }
  ctx.fillStyle = "#08090a"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '600 54px "Google Sans", Arial, sans-serif';
  const measured = ctx.measureText(label).width;
  if (measured > 730) ctx.font = `600 ${Math.max(22, Math.floor(54 * 730 / measured))}px "Google Sans", Arial, sans-serif`;
  ctx.fillText(label, 540, 1105);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
}
