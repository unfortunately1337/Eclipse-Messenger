import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEncryptedMedia, collectLegacyMediaUrls, encryptMediaBlob, resolveEncryptedMediaUrl, resolveMessageMedia } from "./media-crypto";
import { clearMediaBlobCache, hasCachedMediaUrl } from "./media-cache";
const nativeFetch = globalThis.fetch;

describe("client attachment encryption", () => {
  beforeEach(() => { vi.stubGlobal("window", new EventTarget()); });
  afterEach(() => { clearEncryptedMedia(); clearMediaBlobCache(); vi.unstubAllGlobals(); });
  it("uploads ciphertext and restores bytes without sending the key to the server", async () => {
    const original = new Blob(["private attachment"], { type: "image/png" });
    const protectedFile = await encryptMediaBlob(original);
    expect(await protectedFile.blob.text()).not.toBe(await original.text());
    const fetcher = vi.fn().mockResolvedValue(new Response(await protectedFile.blob.arrayBuffer()));
    vi.stubGlobal("fetch", fetcher);
    const src = protectedFile.protectUrl("/media/media/image/test.bin", "secret:test", new Date(Date.now() + 60000).toISOString());
    expect(resolveEncryptedMediaUrl(src)).toBe("");
    await vi.waitFor(() => expect(hasCachedMediaUrl(src)).toBe(true));
    expect(fetcher).toHaveBeenCalledWith("/media/media/image/test.bin", expect.objectContaining({ cache: "no-store" }));
    const displayUrl = resolveEncryptedMediaUrl(src);
    expect(displayUrl).toMatch(/^blob:/);
    const restored = await nativeFetch(displayUrl);
    expect(await restored.text()).toBe(await original.text());
    const raw = { kind: "image", src, caption: "test" };
    expect(resolveMessageMedia(raw).src).toBe(displayUrl);
    expect(raw.src).toBe(src);
    clearEncryptedMedia("secret:test");
    expect(hasCachedMediaUrl(src)).toBe(false);
  });
  it("does not fetch expired attachments", async () => {
    const file = await encryptMediaBlob(new Blob(["private"]));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(resolveEncryptedMediaUrl(file.protectUrl("/media/test", "secret:test", new Date(0).toISOString()))).toBe("");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("recovers a transient download failure without leaving the recording blank", async () => {
    const file = await encryptMediaBlob(new Blob(["voice bytes"], { type: "audio/webm;codecs=opus" }));
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("network interrupted"))
      .mockResolvedValueOnce(new Response(await file.blob.arrayBuffer()));
    vi.stubGlobal("fetch", fetcher);
    const src = file.protectUrl("/media/retry.bin", "direct:test");
    resolveEncryptedMediaUrl(src);
    await vi.waitFor(() => expect(hasCachedMediaUrl(src)).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
    const restored = await nativeFetch(resolveEncryptedMediaUrl(src));
    expect(await restored.text()).toBe("voice bytes");
    expect(restored.headers.get("content-type")).toBe("audio/webm;codecs=opus");
  });
  it("never caches a late decryption after logout", async () => {
    const file = await encryptMediaBlob(new Blob(["private"]));
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const src = file.protectUrl("/media/test", "secret:test");
    resolveEncryptedMediaUrl(src); clearEncryptedMedia();
    finish(new Response(await file.blob.arrayBuffer()));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(hasCachedMediaUrl(src)).toBe(false);
  });
  it("rejects tampered ciphertext", async () => {
    const file = await encryptMediaBlob(new Blob(["private"]));
    const bytes = new Uint8Array(await file.blob.arrayBuffer()); bytes[0] ^= 1;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
    const src = file.protectUrl("/media/test", "conversation:test");
    resolveEncryptedMediaUrl(src);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(hasCachedMediaUrl(src)).toBe(false);
  });
  it("collects only original local legacy attachments for owner migration", () => {
    expect(collectLegacyMediaUrls('__eclipse_media__:{"type":"album","items":[{"src":"/media/one"},{"src":"https://evil.invalid/a"},{"src":"/media/two#eclipse-e2e=key"}]}')).toEqual(["/media/one"]);
  });
});
