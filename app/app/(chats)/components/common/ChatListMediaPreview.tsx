"use client";

import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getEncryptedMediaExpiresAt, getEncryptedMediaPreview, resolveEncryptedMediaUrl } from "@/lib/client/media-crypto";
import { getCachedMediaUrl, getDecodedMediaPreview } from "@/lib/client/media-cache";
import { rememberDecodedMediaPreview } from "@/lib/client/media-preview";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";

/** Embedded previews need no attachment download. Legacy media is decoded only
 * when its row is visible, using the shared bounded download queue. */
export const ChatListMediaPreview = memo(function ChatListMediaPreview({ src, preview, video = false, round = false }: {
  src: string; preview?: string; video?: boolean; round?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [resolved, setResolved] = useState<{ src: string; url: string } | null>(null);
  const [captured, setCaptured] = useState<{ src: string; preview: string } | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [expiredSrc, setExpiredSrc] = useState<string | null>(null);
  const expiresAt = getEncryptedMediaExpiresAt(src);
  const expired = expiredSrc === src || (expiresAt !== undefined && expiresAt <= Date.now());
  const cached = getCachedMediaUrl(src);
  const poster = expired ? undefined : getEncryptedMediaPreview(src) ?? preview
    ?? (captured?.src === src ? captured.preview : undefined)
    ?? getDecodedMediaPreview(cached);
  const visible = useAnimationVisibility(ref, !poster);
  const displayUrl = resolved?.src === src ? resolved.url : cached !== src || !src.includes("#eclipse-e2e=") ? cached : "";
  const shownUrl = expired ? "" : poster ?? displayUrl;

  useEffect(() => {
    if (expiresAt === undefined || expired) return;
    const timer = setTimeout(() => setExpiredSrc(src), Math.min(2147483647, Math.max(0, expiresAt - Date.now())));
    return () => clearTimeout(timer);
  }, [src, expiresAt, expired]);

  useEffect(() => {
    if (expired || poster || !visible) return;
    const refresh = () => {
      const url = resolveEncryptedMediaUrl(src);
      setResolved(current => current?.src === src && current.url === url ? current : { src, url });
    };
    window.addEventListener("eclipse:media-ready", refresh);
    refresh();
    return () => window.removeEventListener("eclipse:media-ready", refresh);
  }, [src, poster, visible, expired]);

  return <span ref={ref} data-chat-media-preview={video ? "video" : "image"} aria-hidden
    className={cn("relative inline-block h-[18px] w-[18px] shrink-0 overflow-hidden bg-white/10 ring-1 ring-white/10", round ? "rounded-full" : "rounded-[5px]")}>
    {shownUrl && failed !== shownUrl && (poster || !video ? <img src={shownUrl} alt="" draggable={false} loading="lazy"
      className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-150", ready === shownUrl ? "opacity-100" : "opacity-0")}
      onLoad={event => { if (!poster) rememberDecodedMediaPreview(displayUrl, event.currentTarget); setReady(shownUrl); }}
      onError={() => setFailed(shownUrl)} /> : <video src={displayUrl} muted playsInline preload="auto"
      className={cn("absolute inset-0 h-full w-full object-cover", ready === shownUrl ? "opacity-100" : "opacity-0")}
      onLoadedData={event => {
        const details = rememberDecodedMediaPreview(displayUrl, event.currentTarget);
        if (details.preview) setCaptured({ src, preview: details.preview });
        setReady(shownUrl);
      }} onError={() => setFailed(shownUrl)} />)}
  </span>;
});
