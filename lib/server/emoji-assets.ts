import fs from "node:fs/promises";
import path from "node:path";

const cacheDirectory = path.join(process.cwd(), ".cache", "emoji-gifs");
const buffers = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
let cachedBytes = 0;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

export const emojiMirrorUrls = (filename: string) => [
  `https://cdn.jsdelivr.net/gh/goforbg/telegram-emoji-gifs@master/${filename}`,
  `https://raw.githubusercontent.com/goforbg/telegram-emoji-gifs/master/${filename}`,
  `https://cdn.statically.io/gh/goforbg/telegram-emoji-gifs/master/${filename}`,
];

function remember(filename: string, buffer: Buffer) {
  if (buffer.length > MAX_BYTES) return buffer;
  while (buffers.size && (buffers.size >= 100 || cachedBytes + buffer.length > MAX_BYTES)) {
    const oldest = buffers.keys().next().value!;
    cachedBytes -= buffers.get(oldest)!.length;
    buffers.delete(oldest);
  }
  buffers.set(filename, buffer);
  cachedBytes += buffer.length;
  return buffer;
}

/** Filename must be checked against the route's allowlist before calling. */
export function loadEmojiGif(filename: string): Promise<Buffer> {
  if (!/^[a-zA-Z0-9._-]+\.gif$/.test(filename)) return Promise.reject(new Error("Invalid emoji filename"));
  const cached = buffers.get(filename);
  if (cached) {
    buffers.delete(filename);
    buffers.set(filename, cached);
    return Promise.resolve(cached);
  }
  const loading = pending.get(filename);
  if (loading) return loading;
  const task = load(filename).finally(() => pending.delete(filename));
  pending.set(filename, task);
  return task;
}

async function load(filename: string): Promise<Buffer> {
  // Async reads avoid blocking the event loop while other chats are loading.
  for (const candidate of [path.join(process.cwd(), "public", filename), path.join(process.cwd(), "public", "gifs", filename), path.join(cacheDirectory, filename)]) {
    // Public files and the runtime cache are external assets, not server modules.
    try { return remember(filename, await fs.readFile(/* turbopackIgnore: true */ candidate)); } catch { /* Try next location. */ }
  }
  const controllers = emojiMirrorUrls(filename).map(() => new AbortController());
  try {
    const buffer = await Promise.any(emojiMirrorUrls(filename).map(async (url, index) => {
      const response = await fetch(url, { signal: AbortSignal.any([controllers[index]!.signal, AbortSignal.timeout(4_000)]), cache: "force-cache" });
      if (!response.ok || !response.body) throw new Error(`Emoji HTTP ${response.status}`);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_ASSET_BYTES) throw new Error("Emoji asset is too large");
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally { reader.releaseLock(); }
      const result = Buffer.concat(chunks);
      if (!["GIF87a", "GIF89a"].includes(result.subarray(0, 6).toString())) throw new Error("Invalid GIF content");
      return result;
    }));
    controllers.forEach(controller => controller.abort());
    remember(filename, buffer);
    // Keep the disk cache across restarts; callers already share this one write.
    try { await fs.mkdir(cacheDirectory, { recursive: true }); await fs.writeFile(path.join(cacheDirectory, filename), buffer); } catch { /* Optional disk cache. */ }
    return buffer;
  } finally { controllers.forEach(controller => controller.abort()); }
}
