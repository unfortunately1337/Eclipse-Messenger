"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateDefaultAvatarDataUrl } from "@/lib/default-avatar";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;
const GIF_EXT = /\.gif(\?|#|$)/i;

const loadedAvatarUrls = new Set<string>();

export function isAvatarLoaded(url?: string | null): boolean {
  if (!url) return false;
  return loadedAvatarUrls.has(url);
}

export function preloadAvatar(url?: string | null) {
  if (!url || typeof window === "undefined" || loadedAvatarUrls.has(url)) return;
  const img = new Image();
  img.onload = () => {
    loadedAvatarUrls.add(url);
  };
  img.src = url;
}

export function isVideoUrl(src?: string | null) {
  if (!src) return false;
  return VIDEO_EXT.test(src);
}

export function isGifUrl(src?: string | null) {
  if (!src) return false;
  return GIF_EXT.test(src);
}

export function isRealMediaAvatar(src?: string | null): boolean {
  if (!src || typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  if (trimmed.startsWith("data:image/svg+xml") || trimmed.startsWith("<svg") || trimmed.includes("<svg")) {
    return false;
  }
  return true;
}

function useAutoplayOnVisible(ref: React.RefObject<HTMLVideoElement | null>, enabled: boolean, src?: string | null) {
  const visible = useAnimationVisibility(ref, enabled);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (enabled && visible) void video.play().catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [enabled, ref, src, visible]);
}

type MediaAvatarProps = {
  src?: string | null;
  alt: string;
  className?: string;
  videoClassName?: string;
  imgClassName?: string;
  fallbackText?: string;
  autoPlay?: boolean;
  shape?: "circle" | "square";
};

export const MediaAvatar = memo(function MediaAvatar({
  src,
  alt,
  className,
  videoClassName,
  imgClassName,
  fallbackText,
  autoPlay = true,
  shape = "circle",
}: MediaAvatarProps) {
  const defaultAvatar = useMemo(() => !src ? generateDefaultAvatarDataUrl(alt, "", shape) : null, [src, alt, shape]);
  const isVideo = useMemo(() => isVideoUrl(src), [src]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useAutoplayOnVisible(videoRef, Boolean(isVideo && autoPlay), src);

  const [loadedSrc, setLoadedSrc] = useState(() => (src && !isVideo && loadedAvatarUrls.has(src) ? src : null));
  const isCached = Boolean(src && !isVideo && loadedSrc === src);

  useEffect(() => {
    if (src && !isVideo) {
      if (loadedAvatarUrls.has(src)) {
        setLoadedSrc(src ?? null);
      }
    }
  }, [src, isVideo]);

  return (
    <Avatar className={cn(className, shape === "square" && "rounded-none")}>
      {defaultAvatar ? (
        <img src={defaultAvatar} alt={alt} className={cn("aspect-square size-full object-cover select-none", imgClassName)} />
      ) : src && isVideo ? (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          autoPlay={false}
          className={cn("h-full w-full object-cover", videoClassName)}
          aria-label={alt}
        />
      ) : src ? (
        isCached ? (
          <img
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            className={cn("aspect-square size-full object-cover select-none", imgClassName)}
          />
        ) : (
          <AvatarImage
            src={src}
            alt={alt}
            className={cn("object-cover", imgClassName)}
            onLoad={() => {
              if (src) loadedAvatarUrls.add(src);
              setLoadedSrc(src ?? null);
            }}
          />
        )
      ) : null}
      {!defaultAvatar && !isCached && (
        <AvatarFallback
          className={cn("text-[10px] font-semibold select-none", imgClassName, shape === "square" && "rounded-none")}
          style={{
            fontFamily: "'SF Pro Rounded', 'Segoe UI Variable Rounded', 'Nunito', 'Arial Rounded MT Bold', -apple-system, BlinkMacSystemFont, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          {(fallbackText || alt || "U").trim().slice(0, 1).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  );
});

type MediaBannerProps = {
  src?: string | null;
  className?: string;
  mediaClassName?: string;
  overlayClassName?: string;
  autoPlay?: boolean;
  alt?: string;
};

export const MediaBanner = memo(function MediaBanner({
  src,
  className,
  mediaClassName,
  overlayClassName,
  autoPlay = true,
  alt = "banner",
}: MediaBannerProps) {
  const isVideo = useMemo(() => isVideoUrl(src), [src]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useAutoplayOnVisible(videoRef, Boolean(isVideo && autoPlay), src);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {src ? (
        isVideo ? (
          <video
            ref={videoRef}
            src={src}
            muted
            loop
            playsInline
            preload="metadata"
            autoPlay={false}
            className={cn("absolute inset-0 h-full w-full object-cover", mediaClassName)}
            aria-label={alt}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            className={cn("absolute inset-0 h-full w-full object-cover", mediaClassName)}
            loading="lazy"
          />
        )
      ) : null}
      {overlayClassName ? <div className={cn("pointer-events-none absolute inset-0", overlayClassName)} /> : null}
    </div>
  );
});
