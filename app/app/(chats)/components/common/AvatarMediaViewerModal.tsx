"use client";
import { dateLocale, plural, translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { MediaViewerTopBar } from "./MediaViewerTopBar";
import { Skiper91 } from "@/components/ui/skiper91";
import { isVideoUrl, isRealMediaAvatar } from "@/components/ui/media";
import { getCachedMediaUrl } from "@/lib/client/media-cache";

// Global cache for media upload timestamps to avoid duplicate network requests
const mediaUploadedAtCache = new Map<string, string>();

export function formatTelegramMediaDate(timestamp?: string | number | Date | null): string {
  if (timestamp == null) return "";
  const validDate = new Date(timestamp);
  if (isNaN(validDate.getTime())) return "";
  const now = new Date();

  const isToday =
    validDate.getDate() === now.getDate() &&
    validDate.getMonth() === now.getMonth() &&
    validDate.getFullYear() === now.getFullYear();

  const timeStr = validDate.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return t("сегодня в {0}", { 0: timeStr });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    validDate.getDate() === yesterday.getDate() &&
    validDate.getMonth() === yesterday.getMonth() &&
    validDate.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return t("вчера в {0}", { 0: timeStr });
  }

  const months = [
    t("января"), t("февраля"), t("марта"), t("апреля"), t("мая"), t("июня"),
    t("июля"), t("августа"), t("сентября"), t("октября"), t("ноября"), t("декабря"),
  ];
  const day = validDate.getDate();
  const month = months[validDate.getMonth()];

  if (validDate.getFullYear() === now.getFullYear()) {
    return t("{0} {1} в {2}", { 0: day, 1: month, 2: timeStr });
  }

  return t("{0} {1} {2} г. в {3}", { 0: day, 1: month, 2: validDate.getFullYear(), 3: timeStr });
}

export type AvatarMediaViewerModalProps = {
  open: boolean;
  onClose: () => void;
  mediaUrl?: string | null;
  title?: string;
  subtitle?: string;
  timestamp?: string | number | Date | null;
  showUploadTimestamp?: boolean;
  fallbackText?: string;
  onDelete?: () => Promise<void> | void;
  isDeleting?: boolean;
  zIndex?: number;
};

export function AvatarMediaViewerModal({
  open,
  onClose,
  mediaUrl,
  title,
  subtitle,
  timestamp,
  showUploadTimestamp = false,
  fallbackText,
  onDelete,
  isDeleting = false,
  zIndex = 350,
}: AvatarMediaViewerModalProps) {
  const t = useTranslation();
  const isReal = isRealMediaAvatar(mediaUrl);
  const resolvedUrl = mediaUrl ? getCachedMediaUrl(mediaUrl) : null;
  const isVideo = isVideoUrl(resolvedUrl);

  const [serverMetadata, setServerMetadata] = useState<{ mediaUrl: string; uploadedAt: string } | null>(null);
  const cachedUploadedAt = showUploadTimestamp && mediaUrl ? mediaUploadedAtCache.get(mediaUrl) : undefined;

  // Query media server for the exact upload timestamp of this media file
  useEffect(() => {
    if (!showUploadTimestamp || !open || !mediaUrl || !isReal) {
      return;
    }
    if (mediaUploadedAtCache.has(mediaUrl)) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/media/meta?url=${encodeURIComponent(mediaUrl)}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const uploadedAt = data?.data?.uploadedAt;
          if (active && uploadedAt) {
            mediaUploadedAtCache.set(mediaUrl, uploadedAt);
            setServerMetadata({ mediaUrl, uploadedAt });
            return;
          }
        }
      } catch {}

      try {
        const targetUrl = getCachedMediaUrl(mediaUrl) || mediaUrl;
        const headRes = await fetch(targetUrl, { method: "HEAD" });
        const lastMod = headRes.headers.get("x-uploaded-at") || headRes.headers.get("last-modified");
        if (active && lastMod) {
          mediaUploadedAtCache.set(mediaUrl, lastMod);
          setServerMetadata({ mediaUrl, uploadedAt: lastMod });
        }
      } catch {}
    })();

    return () => {
      active = false;
    };
  }, [open, mediaUrl, isReal, showUploadTimestamp]);

  const displaySubtitle = useMemo(() => {
    if (!showUploadTimestamp) return "";
    const effectiveTimestamp = cachedUploadedAt || (serverMetadata && serverMetadata.mediaUrl === mediaUrl ? serverMetadata.uploadedAt : null) || timestamp;
    if (effectiveTimestamp) {
      return formatTelegramMediaDate(effectiveTimestamp);
    }
    if (subtitle && !["Фотография профиля", "Аватар группы", "Аватар канала", "Аватар"].includes(subtitle.trim())) {
      const parsed = Date.parse(subtitle);
      if (!isNaN(parsed) && (subtitle.includes("-") || subtitle.includes(":"))) {
        return formatTelegramMediaDate(parsed);
      }
      return subtitle;
    }
    return "";
  }, [showUploadTimestamp, cachedUploadedAt, serverMetadata, mediaUrl, timestamp, subtitle]);

  // Close on Escape key and lock scroll while open
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = (title ? `${title}.` : "media.") + (isVideo ? "mp4" : "jpg");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch {
      window.open(resolvedUrl, "_blank");
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && resolvedUrl ? <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t("Просмотр аватара")}
        data-avatar-media-viewer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ zIndex }}
        className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black text-white select-none md:bg-black/84 md:backdrop-blur-[2px]"
      >
        <button type="button" className="absolute inset-0" onClick={onClose} aria-label={t("Закрыть просмотр аватара")} />
        <MediaViewerTopBar
          authorName={title || t("Профиль")}
          dateText={displaySubtitle}
          src={resolvedUrl}
          downloadLabel={t("Сохранить аватар")}
          onDownload={handleDownload}
          onClose={onClose}
          onDelete={onDelete ? () => { void onDelete(); } : undefined}
          deleting={isDeleting}
        />
        <div className="pointer-events-none relative z-[1] flex h-full w-full items-center justify-center p-2 pt-[68px] pb-6 sm:p-4 sm:pt-[72px] sm:pb-6">
          <motion.div
            className="pointer-events-none relative flex h-full w-full items-center justify-center"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {isVideo ? (
              <Skiper91
                src={resolvedUrl}
                autoPlay
                loop
                playsInline
                accentColor="var(--ui-accent-solid, #71717a)"
                className="pointer-events-auto h-full w-full"
                videoClassName="h-full w-full max-h-[calc(100dvh-110px)] max-w-[calc(100vw-16px)] object-contain rounded-2xl md:max-w-[min(90vw,1200px)] md:rounded-3xl shadow-2xl"
              />
            ) : (
              <img
                src={resolvedUrl}
                alt={title || t("Аватар")}
                className="pointer-events-auto h-auto w-auto max-h-[calc(100dvh-110px)] max-w-[calc(100vw-16px)] object-contain rounded-2xl md:max-w-[min(90vw,1200px)] md:rounded-3xl shadow-2xl"
              />
            )}
          </motion.div>
        </div>
      </motion.div> : null}
    </AnimatePresence>,
    document.body,
  );
}
