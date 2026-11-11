"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type ConversationResponse } from "../types";
import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MediaViewerTopBar } from "../components/common/MediaViewerTopBar";
import { Skiper91 } from "@/components/ui/skiper91";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";
import { getEncryptedMediaPreview, resolveEncryptedMediaUrl } from "@/lib/client/media-crypto";
import { getCachedMediaUrl, getDecodedMediaPreview } from "@/lib/client/media-cache";
import { THEME_SOLID_COLOR_MAP } from "../components/common/TelegramDoodleWallpaper";

export interface ConversationVideoViewerProps {
  videoViewer: { src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null;
  videoViewerRef: React.RefObject<HTMLVideoElement | null>;
  setVideoViewer: React.Dispatch<React.SetStateAction<{ src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null>>;
  setVideoViewerFailed: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoViewerPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoViewerProgress: React.Dispatch<React.SetStateAction<number>>;
  setVideoViewerCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setVideoViewerMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  activeConversation: ConversationResponse | null;
  handleVideoViewerAuthorClick: () => void;
  videoViewerMenuOpen: boolean;
  deleteMessage: (messageId: string) => Promise<void>;
  deletingMessageId: string | null;
  liveBackgroundPreset: LiveBackgroundNeatPreset;
}

export const ConversationVideoViewer = memo(function ConversationVideoViewer({ videoViewer, videoViewerRef, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying, setVideoViewerProgress, setVideoViewerCurrentTime, setVideoViewerMenuOpen, t, activeConversation, handleVideoViewerAuthorClick, videoViewerMenuOpen, deleteMessage, deletingMessageId, liveBackgroundPreset }: ConversationVideoViewerProps) {
  return (
    <AnimatePresence>
      {videoViewer ? (
        <motion.div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black text-white md:bg-black/84 md:backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => {
              const video = videoViewerRef.current;
              if (video) video.pause();
              setVideoViewer(null);
              setVideoViewerFailed(false);
              setVideoViewerPlaying(false);
              setVideoViewerProgress(0);
              setVideoViewerCurrentTime(0);
              setVideoViewerMenuOpen(false);
            }}
            aria-label={t("Закрыть просмотр видео")}
          />
          <MediaViewerTopBar
            authorName={videoViewer.authorName}
            authorAvatarUrl={videoViewer.authorAvatarUrl}
            dateText={videoViewer.dateText}
            src={resolveEncryptedMediaUrl(videoViewer.src)}
            downloadLabel={t("Сохранить видео")}
            isMine={Boolean(videoViewer.isMine || activeConversation?.chatType === "saved" || videoViewer.authorName === "Вы")}
            onAuthorClick={handleVideoViewerAuthorClick}
            menuOpen={videoViewerMenuOpen}
            onToggleMenu={() => setVideoViewerMenuOpen((prev) => !prev)}
            onClose={() => {
              const video = videoViewerRef.current;
              if (video) video.pause();
              setVideoViewer(null);
              setVideoViewerFailed(false);
              setVideoViewerPlaying(false);
              setVideoViewerProgress(0);
              setVideoViewerCurrentTime(0);
              setVideoViewerMenuOpen(false);
            }}
            onDelete={videoViewer.canDelete ? () => {
              const messageId = videoViewer.messageId;
              const video = videoViewerRef.current;
              if (video) video.pause();
              setVideoViewer(null);
              setVideoViewerFailed(false);
              setVideoViewerPlaying(false);
              setVideoViewerProgress(0);
              setVideoViewerCurrentTime(0);
              setVideoViewerMenuOpen(false);
              void deleteMessage(messageId);
            } : undefined}
            deleting={deletingMessageId === videoViewer.messageId}
          />
          <div className="relative z-[1] flex h-full w-full items-center justify-center pointer-events-none p-2 sm:p-4 pt-[68px] sm:pt-[72px] pb-[120px] sm:pb-[130px]">
            <motion.div
              className="relative flex h-full w-full items-center justify-center pointer-events-auto"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <Skiper91
                ref={videoViewerRef}
                src={resolveEncryptedMediaUrl(videoViewer.src)}
                poster={getEncryptedMediaPreview(videoViewer.src) ?? getDecodedMediaPreview(getCachedMediaUrl(videoViewer.src))}
                autoPlay
                accentColor={
                  liveBackgroundPreset !== "none" && THEME_SOLID_COLOR_MAP[liveBackgroundPreset]
                    ? THEME_SOLID_COLOR_MAP[liveBackgroundPreset]
                    : "#71717a"
                }
                className="h-full w-full"
                videoClassName="w-full h-full max-h-[calc(100dvh-180px)] max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)] md:max-h-[calc(100dvh-190px)] md:max-w-[min(90vw,1200px)] object-contain rounded-2xl md:rounded-3xl shadow-2xl"
                onError={() => setVideoViewerFailed(true)}
              />
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}, (previous, next) => !previous.videoViewer && !next.videoViewer);
