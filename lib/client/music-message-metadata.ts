"use client";

import { readAudioFileMetadata, type AudioFileMetadata } from "./audio-file-metadata";
import { loadEncryptedMediaBlob } from "./media-crypto";
import { cacheMediaBlobUrl, getCachedMediaUrl, hasCachedMediaUrl } from "./media-cache";

const pending = new Map<string, Promise<AudioFileMetadata>>();
let generation = 0;
if (typeof window !== "undefined") {
  window.addEventListener("eclipse:caches-cleared", () => { generation += 1; pending.clear(); });
}

// Older caption edits dropped all tags from the descriptor, but left the audio
// file intact. Recover its embedded tags locally without changing the caption.
export async function recoverMusicMessageMetadata(url: string) {
  const current = generation;
  let request = pending.get(url);
  if (!request) {
    request = loadEncryptedMediaBlob(url).then(readAudioFileMetadata);
    if (pending.size >= 16) pending.delete(pending.keys().next().value!);
    pending.set(url, request);
    request.catch(() => { if (pending.get(url) === request) pending.delete(url); });
  }
  const metadata = await request;
  if (current !== generation) return {};
  const coverKey = `eclipse:music-cover:${url}`;
  if (metadata.cover && !hasCachedMediaUrl(coverKey)) cacheMediaBlobUrl(coverKey, URL.createObjectURL(metadata.cover));
  return { author: metadata.author, coverUrl: hasCachedMediaUrl(coverKey) ? getCachedMediaUrl(coverKey) : undefined };
}
