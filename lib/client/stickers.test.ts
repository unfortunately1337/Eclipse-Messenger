import { afterEach, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { fetchStickerAnimationData } from "./stickers";
afterEach(() => vi.unstubAllGlobals());
it("shares concurrent downloads and decompression of a TGS sticker", async () => {
  const data = { v: "5.12", layers: [], w: 512, h: 512 };
  const fetch = vi.fn().mockResolvedValue(new Response(gzipSync(JSON.stringify(data)))); vi.stubGlobal("fetch", fetch);
  const results = await Promise.all(Array.from({ length: 20 }, () => fetchStickerAnimationData("/stickers/shared.tgs")));
  expect(results.every(result => result === results[0])).toBe(true); expect(results[0]).toEqual(data); expect(fetch).toHaveBeenCalledOnce();
});
it("retries after a failed sticker download", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ layers: [] })); vi.stubGlobal("fetch", fetch);
  await expect(fetchStickerAnimationData("/stickers/retry.json")).rejects.toThrow("offline");
  await expect(fetchStickerAnimationData("/stickers/retry.json")).resolves.toEqual({ layers: [] }); expect(fetch).toHaveBeenCalledTimes(2);
});
it("evicts unused animation data rather than growing the cache indefinitely", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({ layers: [] })); vi.stubGlobal("fetch", fetch);
  for (let i = 0; i < 65; i++) await fetchStickerAnimationData(`/stickers/limited-${i}.json`);
  await fetchStickerAnimationData("/stickers/limited-0.json"); expect(fetch).toHaveBeenCalledTimes(66);
});
