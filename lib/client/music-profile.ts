import { loadEncryptedMediaBlob } from "./media-crypto";

// URLs change when an encrypted attachment is copied to another chat.
// Compare the decoded file instead of its location or song title.
const fingerprints = new Map<string, Promise<string>>();

async function fingerprint(url: string) {
  let pending = fingerprints.get(url);
  if (!pending) {
    pending = (async () => {
      const blob = await loadEncryptedMediaBlob(url);
      const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    })();
    if (fingerprints.size >= 32) fingerprints.delete(fingerprints.keys().next().value!);
    fingerprints.set(url, pending);
    pending.catch(() => { if (fingerprints.get(url) === pending) fingerprints.delete(url); });
  }
  return pending;
}

export async function isSameProfileMusic(savedUrl: string | null | undefined, trackUrl: string) {
  const saved = savedUrl?.trim();
  const track = trackUrl.trim();
  if (!saved || !track) return false;
  if (saved === track) return true;
  try {
    const [left, right] = await Promise.all([fingerprint(saved), fingerprint(track)]);
    return left === right;
  } catch {
    return false;
  }
}

export async function prepareProfileMusicMedia(url: string, kind: "audio" | "image", upload: (blob: Blob, kind: "audio" | "image") => Promise<string>) {
  if (!url.startsWith("blob:") && !url.startsWith("/media/")) return url;
  return upload(await loadEncryptedMediaBlob(url), kind);
}
