"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getCachedMediaUrl, getDecodedMediaPreview } from "@/lib/client/media-cache";
import { getEncryptedMediaExpiresAt, getEncryptedMediaPreview, resolveEncryptedMediaUrl } from "@/lib/client/media-crypto";
import { ChatImageThumb, ChatVideoThumb } from "./media-thumbnails";

const emptySnapshot = () => "";
const expiredSnapshot = "expired-profile-media";

/** Keep the original attachment identity and its preview while decryption runs. */
export function ProfileMediaThumb({ src, preview, video = false, alt = "", className }: {
  src: string; preview?: string; video?: boolean; alt?: string; className?: string;
}) {
  const snapshot = useCallback(() => {
    const expiresAt = getEncryptedMediaExpiresAt(src);
    if (expiresAt !== undefined && expiresAt <= Date.now()) return expiredSnapshot;
    const cached = getCachedMediaUrl(src);
    return cached === src && src.includes("#eclipse-e2e=") ? "" : cached;
  }, [src]);
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("eclipse:media-ready", notify);
    resolveEncryptedMediaUrl(src);
    const expiresAt = getEncryptedMediaExpiresAt(src);
    const timer = expiresAt !== undefined ? setTimeout(notify, Math.min(2147483647, Math.max(0, expiresAt - Date.now()))) : undefined;
    return () => { window.removeEventListener("eclipse:media-ready", notify); clearTimeout(timer); };
  }, [src]);
  const resolved = useSyncExternalStore(subscribe, snapshot, emptySnapshot);
  const expired = resolved === expiredSnapshot;
  const poster = expired ? undefined : getEncryptedMediaPreview(src) ?? preview ?? getDecodedMediaPreview(resolved || src);
  return video
    ? <ChatVideoThumb src={expired ? "" : resolved} preview={poster} fill autoPlay={false} className={className} />
    : <ChatImageThumb src={expired ? "" : resolved} preview={poster} fill alt={alt} className={className} />;
}
