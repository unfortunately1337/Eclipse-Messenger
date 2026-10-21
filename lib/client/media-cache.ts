/**
 * Client-side media cache for instant local rendering.
 * Maps remote media URLs (/media/...) to local blob URLs (blob:...)
 * created when sending photos and videos, eliminating redundant network fetches,
 * flickers, and loaders for the sender.
 */

const MAX_CACHED_ITEMS = 120;
const mediaBlobCache = new Map<string, string>();

export function cacheMediaBlobUrl(serverUrl: string, blobUrl: string): void {
  if (!serverUrl || !blobUrl) return;
  const previous = mediaBlobCache.get(serverUrl);
  if (previous && previous !== blobUrl) {
    try { URL.revokeObjectURL(previous); } catch {}
  }

  // If already reached limit, evict the oldest entry
  if (!previous && mediaBlobCache.size >= MAX_CACHED_ITEMS) {
    const firstKey = mediaBlobCache.keys().next().value;
    if (firstKey) {
      const oldBlob = mediaBlobCache.get(firstKey);
      if (oldBlob && oldBlob.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(oldBlob);
        } catch {
          // ignore
        }
      }
      mediaBlobCache.delete(firstKey);
    }
  }

  mediaBlobCache.set(serverUrl, blobUrl);
}

export function getCachedMediaUrl(src: string): string {
  if (!src) return "";
  return mediaBlobCache.get(src) || src;
}

export function hasCachedMediaUrl(src: string): boolean {
  if (!src) return false;
  return mediaBlobCache.has(src);
}

export function invalidateCachedMediaUrl(src: string): void {
  if (!src) return;
  const blobUrl = mediaBlobCache.get(src);
  if (blobUrl) {
    mediaBlobCache.delete(src);
    if (blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }
  }
}

export function clearMediaBlobCache(): void {
  for (const key of [...mediaBlobCache.keys()]) invalidateCachedMediaUrl(key);
}
