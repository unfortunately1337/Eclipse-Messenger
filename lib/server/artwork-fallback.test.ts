import { expect, it } from "vitest";
import { gunzipSync } from "node:zlib";
import { EMOJI_STATUS_CATALOG } from "@/lib/emoji-status";
import inlineAssets from "@/lib/client/inline-emoji-assets.json";
import { artworkFallback, artworkFallbackResponse } from "./artwork-fallback";

it("covers every optional custom emoji without redistributing its artwork", () => {
  for (const entry of EMOJI_STATUS_CATALOG) {
    expect(artworkFallback(entry.thumbnail)?.contentType).toContain("image/svg+xml");
    expect(artworkFallback(entry.preview!)?.body).toContain("<svg");
    const result = artworkFallback(entry.animation)!;
    const animation = JSON.parse(gunzipSync(result.body as Uint8Array).toString());
    expect(animation.layers[0].t.d.k[0].s.t).toBe(entry.emoji);
    expect(animation.assets).toEqual([]);
  }
});

it("covers all Default previews and larger message emoji", () => {
  for (const asset of Object.values(inlineAssets)) {
    for (const path of [asset.preview, asset.still, asset.large, asset.largeStill]) {
      expect(artworkFallback(path)?.contentType).toContain("image/svg+xml");
    }
  }
});

it("rejects unknown paths, traversal and injected markup", async () => {
  for (const path of ["/gifs/../../.env", "/gifs/<script>.gif", "/uploads/private.webp", "/gifs/not-a-known-asset.gif", "/gifs/toString"]) {
    expect(artworkFallbackResponse(path).status).toBe(404);
  }
  const response = artworkFallbackResponse("/gifs/auth-monkey/idle.webp");
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(await response.text()).not.toMatch(/<script|https?:\/\/[^w]/);
});
