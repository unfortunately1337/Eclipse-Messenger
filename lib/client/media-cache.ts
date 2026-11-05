/**
 * Client-side media cache for instant local rendering.
 * Maps remote media URLs (/media/...) to local blob URLs (blob:...)
 * created when sending photos and videos, eliminating redundant network fetches,
 * flickers, and loaders for the sender.
 */

const MAX_CACHED_ITEMS = 120;
const mediaBlobCache = new Map<string, string>();
const mediaPreviewCache = new Map<string, string>();

export function cacheDecodedMediaPreview(src: string, preview: string): void {
  if (!src || mediaPreviewCache.has(src)) return;
  if (mediaPreviewCache.size >= MAX_CACHED_ITEMS) {
    const oldest = mediaPreviewCache.keys().next().value;
    if (oldest) mediaPreviewCache.delete(oldest);
  }
  mediaPreviewCache.set(src, preview);
}

export function getDecodedMediaPreview(src: string): string | undefined {
  return mediaPreviewCache.get(src);
}

export function cacheMediaBlobUrl(serverUrl: string, blobUrl: string): void {
  if (!serverUrl || !blobUrl) return;
  const previous = mediaBlobCache.get(serverUrl);
  if (previous && previous !== blobUrl) {
    mediaPreviewCache.delete(previous);
    try { URL.revokeObjectURL(previous); } catch {}
  }

  // If already reached limit, evict the oldest entry
  if (!previous && mediaBlobCache.size >= MAX_CACHED_ITEMS) {
    const firstKey = mediaBlobCache.keys().next().value;
    if (firstKey) {
      const oldBlob = mediaBlobCache.get(firstKey);
      if (oldBlob && oldBlob.startsWith("blob:")) {
        mediaPreviewCache.delete(oldBlob);
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
  mediaPreviewCache.delete(src);
  const blobUrl = mediaBlobCache.get(src);
  if (blobUrl) {
    mediaBlobCache.delete(src);
    mediaPreviewCache.delete(blobUrl);
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
  mediaPreviewCache.clear();
}
