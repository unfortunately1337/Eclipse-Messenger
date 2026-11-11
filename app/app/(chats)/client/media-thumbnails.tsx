"use client";

/* eslint-disable @next/next/no-img-element */
import { useTranslation } from "@/components/LocaleProvider";
import { CSSProperties, useState } from "react";
import { cn } from "@/lib/utils";
import { rememberDecodedMediaPreview } from "@/lib/client/media-preview";
import { MediaLoadingPreview } from "@/components/MediaLoadingPreview";
import { getCachedMediaUrl, getDecodedMediaPreview, getLocalMediaAspectRatio } from "@/lib/client/media-cache";
import { getJpegPreviewAspectRatio, normalizeMediaAspectRatio } from "@/lib/media-preview";

export function formatSharedFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function chatMediaFrameStyle(aspectRatio: number): CSSProperties {
  const ratio = Math.min(12, Math.max(0.2, aspectRatio));
  return { aspectRatio: ratio, "--media-width": `${Math.round(360 * ratio)}px` } as CSSProperties;
}

export const CHAT_MEDIA_FRAME_WIDTH = "w-[min(260px,calc(100vw-64px),var(--media-width))] max-w-full md:w-[min(420px,var(--media-width))]";

export function ChatImageThumb({
  src, preview, aspectRatio, alt, className, viewer = false, fill = false,
}: {
  src: string;
  preview?: string;
  aspectRatio?: number;
  alt: string;
  className?: string;
  viewer?: boolean;
  fill?: boolean;
}) {
  const t = useTranslation();
  const resolvedSrc = getCachedMediaUrl(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [decodedSize, setDecodedSize] = useState<{ src: string; ratio: number } | null>(null);
  const loaded = Boolean(resolvedSrc && loadedSrc === resolvedSrc);
  const failed = Boolean(resolvedSrc && failedSrc === resolvedSrc);
  const frameRatio = (decodedSize?.src === resolvedSrc ? decodedSize.ratio : undefined)
    ?? normalizeMediaAspectRatio(aspectRatio)
    ?? getLocalMediaAspectRatio(resolvedSrc)
    ?? getJpegPreviewAspectRatio(preview ?? getDecodedMediaPreview(resolvedSrc))
    ?? 4 / 3;
  return (
    <div aria-busy={!loaded && !failed} style={fill || viewer ? undefined : chatMediaFrameStyle(frameRatio)} className={cn(
      "relative overflow-hidden rounded-[inherit]",
      fill || viewer ? "h-full w-full" : CHAT_MEDIA_FRAME_WIDTH,
      viewer ? "flex items-center justify-center" : "bg-zinc-900/60",
    )}>
      {!loaded && <MediaLoadingPreview
        preview={preview ?? getDecodedMediaPreview(resolvedSrc)}
        fit={viewer || className?.includes("object-contain") ? "contain" : "cover"}
        loading={!failed}
      />}
      {resolvedSrc && !failed && <img
        src={resolvedSrc} alt={alt} draggable={false}
        className={cn("h-full w-full rounded-[inherit] transition-opacity duration-150 ease-out", className,
          !viewer && "absolute inset-0 max-h-none max-w-none",
          loaded ? "opacity-100" : "opacity-0")}
        onLoad={event => {
          const { aspectRatio: ratio } = rememberDecodedMediaPreview(resolvedSrc, event.currentTarget);
          if (ratio) setDecodedSize({ src: resolvedSrc, ratio });
          setLoadedSrc(resolvedSrc);
        }}
        onError={() => setFailedSrc(resolvedSrc)}
      />}
      {failed && <span role="status" className="absolute inset-0 grid place-items-center text-xs text-zinc-300">{t("Файл недоступен")}</span>}
    </div>
  );
}

export function ChatVideoThumb({ src, preview, aspectRatio, className, fill = false, autoPlay = true }: {
  src: string;
  preview?: string;
  aspectRatio?: number;
  className?: string;
  fill?: boolean;
  autoPlay?: boolean;
}) {
  const t = useTranslation();
  const resolvedSrc = getCachedMediaUrl(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [decodedSize, setDecodedSize] = useState<{ src: string; ratio: number } | null>(null);
  const loaded = Boolean(resolvedSrc && loadedSrc === resolvedSrc);
  const failed = Boolean(resolvedSrc && failedSrc === resolvedSrc);
  const frameRatio = (decodedSize?.src === resolvedSrc ? decodedSize.ratio : undefined)
    ?? normalizeMediaAspectRatio(aspectRatio)
    ?? getLocalMediaAspectRatio(resolvedSrc)
    ?? getJpegPreviewAspectRatio(preview ?? getDecodedMediaPreview(resolvedSrc))
    ?? 16 / 9;
  return (
    <div aria-busy={!loaded && !failed} style={fill ? undefined : chatMediaFrameStyle(frameRatio)} className={cn(
      "relative overflow-hidden rounded-[inherit] bg-zinc-900/60",
      fill ? "h-full w-full" : CHAT_MEDIA_FRAME_WIDTH,
    )}>
      {!loaded && <MediaLoadingPreview
        preview={preview ?? getDecodedMediaPreview(resolvedSrc)}
        fit={className?.includes("object-contain") ? "contain" : "cover"}
        loading={!failed}
      />}
      {resolvedSrc && !failed && <video
        src={resolvedSrc}
        className={cn("absolute inset-0 h-full w-full rounded-[inherit] transition-opacity duration-150 ease-out", className, "max-h-none max-w-none",
          loaded ? "opacity-100" : "opacity-0")}
        autoPlay={autoPlay} loop={autoPlay} playsInline muted preload={autoPlay ? "auto" : "metadata"}
        onLoadedMetadata={event => {
          const { aspectRatio: ratio } = rememberDecodedMediaPreview(resolvedSrc, event.currentTarget);
          if (ratio) setDecodedSize({ src: resolvedSrc, ratio });
        }}
        onCanPlay={() => setLoadedSrc(resolvedSrc)}
        onLoadedData={event => {
          rememberDecodedMediaPreview(resolvedSrc, event.currentTarget);
          setLoadedSrc(resolvedSrc);
        }}
        onError={() => setFailedSrc(resolvedSrc)}
      />}
      {failed && <span role="status" className="absolute inset-0 grid place-items-center text-xs text-zinc-300">{t("Видео недоступно")}</span>}
    </div>
  );
}
