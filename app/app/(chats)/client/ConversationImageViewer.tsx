"use client";

import { type ChatImageGalleryItem, type ConversationResponse } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { ReactNode, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { MediaViewerTopBar } from "../components/common/MediaViewerTopBar";
import { LIQUID_GLASS_STYLE } from "@/components/ui/skiper91";
import { getEncryptedMediaPreview, resolveEncryptedMediaUrl } from "@/lib/client/media-crypto";
import { ChatImageThumb } from "./media-thumbnails";

export interface ConversationImageViewerProps {
  imageViewer: ChatImageGalleryItem | null;
  setImageViewer: React.Dispatch<React.SetStateAction<ChatImageGalleryItem | null>>;
  setImageViewerIndex: React.Dispatch<React.SetStateAction<number>>;
  setImageViewerPanelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setImageViewerMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  imageViewerPanelVisible: boolean;
  chatImageGallery: ChatImageGalleryItem[];
  imageViewerIndex: number;
  activeConversation: ConversationResponse | null;
  handleImageViewerAuthorClick: () => void;
  imageViewerMenuOpen: boolean;
  deleteMessage: (messageId: string) => Promise<void>;
  deletingMessageId: string | null;
  handleImageViewerTouchStart: (e: React.TouchEvent<Element>) => void;
  handleImageViewerTouchEnd: (e: React.TouchEvent<Element>) => void;
  stepImageViewer: (direction: 1 | -1) => void;
  imageViewerDirection: 1 | -1;
  renderLinkifiedText: (value: string) => React.ReactNode;
}

export const ConversationImageViewer = memo(function ConversationImageViewer({ imageViewer, setImageViewer, setImageViewerIndex, setImageViewerPanelVisible, setImageViewerMenuOpen, t, imageViewerPanelVisible, chatImageGallery, imageViewerIndex, activeConversation, handleImageViewerAuthorClick, imageViewerMenuOpen, deleteMessage, deletingMessageId, handleImageViewerTouchStart, handleImageViewerTouchEnd, stepImageViewer, imageViewerDirection, renderLinkifiedText }: ConversationImageViewerProps) {
  return (
    <AnimatePresence>
      {imageViewer ? (
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
              setImageViewer(null);
              setImageViewerIndex(-1);
              setImageViewerPanelVisible(true);
              setImageViewerMenuOpen(false);
            }}
            aria-label={t("Закрыть просмотр фото")}
          />
          {imageViewerPanelVisible ? (
            <MediaViewerTopBar
              authorName={imageViewer.authorName}
              authorAvatarUrl={imageViewer.authorAvatarUrl}
              dateText={imageViewer.dateText}
              galleryText={
                chatImageGallery.length > 1 && imageViewerIndex >= 0
                  ? t("{0} из {1}", { 0: imageViewerIndex + 1, 1: chatImageGallery.length })
                  : null
              }
              src={resolveEncryptedMediaUrl(imageViewer.src)}
              downloadLabel={t("Сохранить фото")}
              isMine={Boolean(imageViewer.isMine || activeConversation?.chatType === "saved" || imageViewer.authorName === "Вы")}
              onAuthorClick={handleImageViewerAuthorClick}
              menuOpen={imageViewerMenuOpen}
              onToggleMenu={() => setImageViewerMenuOpen((prev) => !prev)}
              onClose={() => {
                setImageViewer(null);
                setImageViewerIndex(-1);
                setImageViewerPanelVisible(true);
                setImageViewerMenuOpen(false);
              }}
              onDelete={imageViewer.canDelete ? () => {
                const messageId = imageViewer.messageId;
                setImageViewer(null);
                setImageViewerIndex(-1);
                setImageViewerPanelVisible(true);
                setImageViewerMenuOpen(false);
                void deleteMessage(messageId);
              } : undefined}
              deleting={deletingMessageId === imageViewer.messageId}
            />
          ) : null}
          <div
            onTouchStart={handleImageViewerTouchStart}
            onTouchEnd={handleImageViewerTouchEnd}
            className="relative z-[1] flex h-full w-full items-center justify-center p-2 sm:p-4 pt-[68px] sm:pt-[72px] pb-10 sm:pb-12 md:px-[80px] md:py-[72px] select-none touch-pan-y overflow-hidden"
          >
            {chatImageGallery.length > 1 && imageViewerPanelVisible ? (
              <>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    stepImageViewer(-1);
                  }}
                  className="group/navLeft absolute left-0 top-0 bottom-0 z-30 hidden w-28 cursor-pointer items-center justify-start pl-6 md:flex"
                  aria-label={t("Предыдущее фото")}
                >
                  <div className="opacity-0 group-hover/navLeft:opacity-100 transition-all duration-200 text-white/90 group-hover/navLeft:scale-110 active:scale-95 transform-gpu">
                    <ChevronLeft size={44} strokeWidth={2} className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    stepImageViewer(1);
                  }}
                  className="group/navRight absolute right-0 top-0 bottom-0 z-30 hidden w-28 cursor-pointer items-center justify-end pr-6 md:flex"
                  aria-label={t("Следующее фото")}
                >
                  <div className="opacity-0 group-hover/navRight:opacity-100 transition-all duration-200 text-white/90 group-hover/navRight:scale-110 active:scale-95 transform-gpu">
                    <ChevronRight size={44} strokeWidth={2} className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
                  </div>
                </div>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setImageViewerPanelVisible((prev) => !prev);
                setImageViewerMenuOpen(false);
              }}
              className="relative flex h-full w-full items-center justify-center p-0"
              aria-label={t("Показать или скрыть панель")}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={imageViewer.src}
                  initial={{ opacity: 0, x: imageViewerDirection * 50, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -imageViewerDirection * 50, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-full w-full items-center justify-center"
                >
                  <ChatImageThumb
                    src={resolveEncryptedMediaUrl(imageViewer.src)}
                    preview={getEncryptedMediaPreview(imageViewer.src)}
                    viewer
                    alt={t("Фотография")}
                    className="h-full w-full max-h-[calc(100dvh-150px)] max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)] md:max-h-[calc(100dvh-160px)] md:max-w-[min(88vw,1200px)] object-contain rounded-2xl md:rounded-3xl shadow-2xl select-none pointer-events-none"
                  />
                </motion.div>
              </AnimatePresence>
            </button>
            {imageViewerPanelVisible && Boolean(imageViewer.caption?.trim()) ? (
              <div
                data-media-viewer-caption
                onClick={(e) => e.stopPropagation()}
                style={LIQUID_GLASS_STYLE}
                className="pointer-events-auto absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 z-30 flex max-h-[160px] w-[min(580px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl px-4 py-2.5 text-white shadow-2xl border"
              >
                <div className="overflow-y-auto no-scrollbar pr-0.5">
                  <p className="text-left text-[14.5px] font-normal leading-relaxed text-white/95 whitespace-pre-wrap select-text break-words">
                    {renderLinkifiedText(imageViewer.caption ?? "")}
                  </p>
                </div>
                {imageViewer.timeText ? (
                  <div className="mt-1 flex items-center justify-end">
                    <span className="text-[11.5px] font-medium text-white/50">{imageViewer.timeText}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}, (previous, next) => !previous.imageViewer && !next.imageViewer);
