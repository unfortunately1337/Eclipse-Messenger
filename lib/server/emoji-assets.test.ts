import { afterEach, expect, it, vi } from "vitest";
const fs = vi.hoisted(() => ({ readFile: vi.fn(), mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ default: fs }));
import { loadEmojiGif } from "./emoji-assets";
afterEach(() => vi.unstubAllGlobals());
it("shares one mirror race and cache write, cancels losing downloads and reuses the winner", async () => {
  fs.readFile.mockRejectedValue(new Error("ENOENT")); fs.mkdir.mockResolvedValue(undefined); fs.writeFile.mockResolvedValue(undefined);
  const signals: AbortSignal[] = [];
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
    signals.push(init.signal!);
    if (url.includes("jsdelivr")) return Promise.resolve(new Response(Buffer.from("GIF89aexample")));
    return new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true }));
  }); vi.stubGlobal("fetch", fetch);
  const results = await Promise.all(Array.from({ length: 25 }, () => loadEmojiGif("shared-test.gif")));
  expect(results.every(buffer => buffer === results[0])).toBe(true); expect(fetch).toHaveBeenCalledTimes(3); expect(fs.writeFile).toHaveBeenCalledOnce(); expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(await loadEmojiGif("shared-test.gif")).toBe(results[0]); expect(fetch).toHaveBeenCalledTimes(3);
});
it("rejects invalid upstream data without doing a second redundant mirror round", async () => {
  fs.readFile.mockRejectedValue(new Error("ENOENT"));
  const fetch = vi.fn().mockImplementation(async () => new Response("<html>bad mirror</html>")); vi.stubGlobal("fetch", fetch);
  await expect(loadEmojiGif("invalid-test.gif")).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(3);
});
