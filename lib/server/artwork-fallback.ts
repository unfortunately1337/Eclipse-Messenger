import { gzipSync } from "node:zlib";
import catalog from "./artwork-fallback-catalog.json";

const artwork = catalog as Record<string, string>;
const escapeXml = (text: string) => text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);

/** Original, font-based fallbacks; no third-party artwork or remote downloads. */
export function artworkFallback(path: string): { body: string | Uint8Array; contentType: string } | null {
  if (path.length > 180 || !/^\/(gifs|emoji-picker|custom-emoji|tgs|stickers)\/[A-Za-z0-9_./-]+$/.test(path) || path.includes("..")) return null;
  if (!Object.hasOwn(artwork, path)) return null;
  const emoji = artwork[path];
  if (/\.(tgs|json)$/.test(path)) {
    const animation = {
      v: "5.12.2", fr: 30, ip: 0, op: 60, w: 256, h: 256, nm: "Eclipse native emoji fallback", ddd: 0, assets: [],
      fonts: { list: [{ fName: "SystemEmoji", fFamily: "sans-serif", fStyle: "Regular", ascent: 80 }] },
      layers: [{ ddd: 0, ind: 1, ty: 5, nm: "Native emoji", sr: 1, ip: 0, op: 60, st: 0, bm: 0,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [128, 164, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [
          { t: 0, s: [96, 96, 100], e: [102, 102, 100], i: { x: [0.7], y: [1] }, o: { x: [0.3], y: [0] } },
          { t: 30, s: [102, 102, 100], e: [96, 96, 100], i: { x: [0.7], y: [1] }, o: { x: [0.3], y: [0] } },
          { t: 60, s: [96, 96, 100] },
        ] } },
        t: { d: { k: [{ s: { t: emoji, f: "SystemEmoji", s: 112, j: 2, tr: 0, lh: 136, ls: 0, fc: [1, 1, 1] }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] },
      }],
    };
    const json = JSON.stringify(animation);
    return path.endsWith(".tgs")
      ? { body: new Uint8Array(gzipSync(json)), contentType: "application/gzip" }
      : { body: json, contentType: "application/json; charset=utf-8" };
  }
  const tracking = path === "/gifs/auth-monkey/tracking.webp";
  const size = tracking ? 1280 : 256;
  const glyph = escapeXml(emoji);
  const text = tracking
    ? Array.from({ length: 25 }, (_, index) => `<text x="${index % 5 * 256 + 128}" y="${Math.floor(index / 5) * 256 + 172}">${glyph}</text>`).join("")
    : `<text x="128" y="172">${glyph}</text>`;
  return { contentType: "image/svg+xml; charset=utf-8", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif" font-size="144" text-anchor="middle">${text}</g></svg>` };
}

export function artworkFallbackResponse(path: string): Response {
  const result = artworkFallback(path);
  if (!result) return new Response("Artwork not found", { status: 404 });
  return new Response(result.body as BodyInit, { headers: {
    "Content-Type": result.contentType,
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  } });
}
