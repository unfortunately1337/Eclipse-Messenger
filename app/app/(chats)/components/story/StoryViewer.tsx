"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { storyFontStyle } from "@/lib/story-fonts";
import React, { RefObject } from "react";
import { motion, AnimatePresence, useReducedMotion, useIsPresent } from "framer-motion";
import { cn } from "@/lib/utils";
import { MediaAvatar } from "@/components/ui/media";
import { Button } from "@/components/ui/button";
import { Heart, CircleEllipsis, X, Eye } from "lucide-react";
import { MdDelete } from "react-icons/md";
import { Spinner } from "@/components/ui/spinner";
import { StoryDrawingCanvas } from "./StoryDrawingCanvas";
import { StoryLayerContent } from "./StoryLayerContent";
import { StoryAvatarRing } from "./StoryAvatarRing";
import {
  formatStoryPublishedAt,
  formatMessageTimeLabel,
  clampStoryMediaTransform,
  buildStoryMediaTransformStyle,
} from "../../helpers";
import type { StoryFeedGroup, StoryFeedItem, StoryViewerStats } from "../../types";

const loadedStoryMediaUrls = new Set<string>();

export function StoryViewer({
  isOpen,
  origin,
  storyViewer,
  activeStory,
  activeStoryGroup,
  progressRef,
  selfId,
  storyViewerVideoRef,
  storyViewerMoreOpen,
  setStoryViewerMoreOpen,
  storyViewerStatsOpen,
  setStoryViewerStatsOpen,
  storyViewerStats,
  storyViewerStatsFullLoading,

  storyLikePendingId,
  closeStoryViewer,
  loadActiveStoryViewers,
  deleteActiveStory,
  stepStoryViewer,
  holdStoryViewer,
  releaseStoryViewer,
  openStoryAuthorDirect,
  toggleActiveStoryLike,
  onMediaLoaded,
}: {
  isOpen: boolean;
  origin?: { x: number; y: number; scale: number } | null;
  storyViewer: { groupIndex: number; storyIndex: number } | null;
  activeStory: StoryFeedItem;
  activeStoryGroup: StoryFeedGroup;
  progressRef: RefObject<number>;
  selfId: string | null;
  storyViewerVideoRef: RefObject<HTMLVideoElement | null>;
  storyViewerMoreOpen: boolean;
  setStoryViewerMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  storyViewerStatsOpen: boolean;
  setStoryViewerStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  storyViewerStats: StoryViewerStats | null;
  storyViewerStatsFullLoading: boolean;

  storyLikePendingId: string | null;
  closeStoryViewer: () => void;
  loadActiveStoryViewers: (full?: boolean) => void;
  deleteActiveStory: () => void;
  stepStoryViewer: (dir: 1 | -1) => void;
  holdStoryViewer: () => void;
  releaseStoryViewer: () => void;
  openStoryAuthorDirect: (str: string) => void;
  toggleActiveStoryLike: () => void;
  onMediaLoaded?: () => void;
}) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  const present = useIsPresent();
  const gesture = React.useRef<{ x: number; y: number } | null>(null);
  const dismissing = React.useRef(false);
  const entered = React.useRef(Boolean(reducedMotion));
  const progressBar = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!present) return;
    let frame = 0;
    const update = () => {
      const video = storyViewerVideoRef.current;
      const progress = activeStory.mediaType === "video" && video && Number.isFinite(video.duration) && video.duration > 0
        ? video.currentTime / video.duration : progressRef.current;
      if (progressBar.current) progressBar.current.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [present, activeStory.id, activeStory.mediaType, storyViewerVideoRef, progressRef]);
  const dismiss = React.useCallback(() => {
    if (dismissing.current || !present) return;
    dismissing.current = true;
    closeStoryViewer();
  }, [closeStoryViewer, present]);
  const isAlreadyLoaded = React.useMemo(() => {
    return Boolean(activeStory?.mediaUrl && loadedStoryMediaUrls.has(activeStory.mediaUrl));
  }, [activeStory?.mediaUrl]);

  const [mediaLoaded, setMediaLoaded] = React.useState(isAlreadyLoaded);

  const handleMediaReady = React.useCallback(() => {
    if (activeStory?.mediaUrl) {
      loadedStoryMediaUrls.add(activeStory.mediaUrl);
    }
    setMediaLoaded(true);
    if (entered.current && present) onMediaLoaded?.();
  }, [activeStory?.mediaUrl, onMediaLoaded, present]);

  React.useEffect(() => {
    if (activeStory?.mediaUrl && loadedStoryMediaUrls.has(activeStory.mediaUrl)) {
      setMediaLoaded(true);
      if (entered.current && present) onMediaLoaded?.();
    } else {
      setMediaLoaded(false);
    }
  }, [activeStory?.id, activeStory?.mediaUrl, onMediaLoaded, present]);

  if (!isOpen || !activeStory || !activeStoryGroup) return null;

  const activeStoryOverlay = activeStory.overlay ?? { strokes: [], texts: [], media: { scale: 1, x: 0, y: 0 } };

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label={t("Истории")} data-story-viewer
      className="fixed inset-0 z-[200] overflow-hidden bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ touchAction: "none" }}
      onWheel={(event) => {
        if (storyViewerStatsOpen || storyViewerMoreOpen || (event.target as HTMLElement).closest("[data-story-scroll]")) return;
        if (event.deltaY > 25) dismiss();
      }}
      onPointerDownCapture={(event) => {
        if (event.pointerType !== "touch" || storyViewerStatsOpen || storyViewerMoreOpen || (event.target as HTMLElement).closest("[data-story-controls],[data-story-scroll]")) return;
        gesture.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMoveCapture={(event) => {
        const start = gesture.current;
        if (!start) return;
        const dy = event.clientY - start.y;
        if (dy > 64 && dy > Math.abs(event.clientX - start.x) * 1.3) {
          gesture.current = null; event.preventDefault(); dismiss();
        }
      }}
      onPointerUpCapture={() => { gesture.current = null; }}
      onPointerCancelCapture={() => { gesture.current = null; }}
      onClickCapture={(event) => { if (dismissing.current) { event.preventDefault(); event.stopPropagation(); } }}
    >
      <motion.div className="absolute inset-0 overflow-hidden bg-black md:bg-[radial-gradient(circle_at_top,rgba(42,42,48,0.5),rgba(0,0,0,0.98)_58%)]"
        data-story-motion
        initial={reducedMotion ? false : { x: origin?.x ?? 0, y: origin?.y ?? 32, scale: origin?.scale ?? 0.94, opacity: 0.4 }}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        exit={{ x: 0, y: reducedMotion ? 0 : "-100%", scale: 1, opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => { if (present) { entered.current = true; if (mediaLoaded) onMediaLoaded?.(); } }}
        style={{ willChange: "transform, opacity" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[11] h-40 bg-gradient-to-b from-black/72 via-black/28 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[11] h-56 bg-gradient-to-t from-black/76 via-black/28 to-transparent" />
      <div data-story-controls className="absolute inset-x-0 top-0 z-20 px-3 pt-[max(env(safe-area-inset-top),14px)] md:px-6">
        <div className="mx-auto max-w-[430px] md:max-w-[430px]">
          <div className="mb-3 flex items-center gap-1.5">
            {activeStoryGroup.stories.map((story, index) => {
              const segmentProgress =
                index < (storyViewer?.storyIndex ?? 0)
                  ? 1
                  : index === (storyViewer?.storyIndex ?? -1)
                    ? progressRef.current
                    : 0;
              return (
                <div
                  key={`story-progress-${story.id}`}
                  className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/24 shadow-[0_1px_8px_rgba(0,0,0,0.28)]"
                >
                  <div
                    ref={index === storyViewer?.storyIndex ? progressBar : undefined}
                    className="absolute inset-0 origin-left rounded-full bg-white"
                    style={{ transform: `scaleX(${Math.max(0, Math.min(1, segmentProgress))})` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <MediaAvatar
                src={activeStoryGroup.author.avatarUrl ?? undefined}
                alt={activeStoryGroup.author.displayName}
                className="h-10 w-10 shadow-[0_8px_26px_rgba(0,0,0,0.34)] rounded-full overflow-hidden"
                fallbackText={activeStoryGroup.author.displayName.slice(0, 1)}
                autoPlay
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight text-white">
                  {activeStoryGroup.author.id === selfId ? t("Моя история") : activeStoryGroup.author.displayName}
                </p>
                <p className="truncate text-sm text-white/68">{formatStoryPublishedAt(activeStory.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeStory.isMine ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStoryViewerMoreOpen(false);
                      setStoryViewerStatsOpen(true);
                      loadActiveStoryViewers(true);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
                    aria-label={t("Открыть статистику просмотров истории")}
                  >
                    <Eye size={18} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setStoryViewerMoreOpen(!storyViewerMoreOpen);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
                      aria-label={t("Действия с историей")}
                    >
                      <CircleEllipsis size={18} />
                    </button>
                    <AnimatePresence>
                      {storyViewerMoreOpen ? (
                        <motion.div
                          className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[176px] rounded-2xl border border-white/[0.08] bg-[#181818]/95 p-1.5 shadow-2xl backdrop-blur-xl"
                          initial={{ opacity: 0, y: -8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.16, ease: "easeOut" }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setStoryViewerMoreOpen(false);
                              deleteActiveStory();
                            }}
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-white/5 cursor-pointer"
                          >
                            <MdDelete size={17} />
                            <span>{t("Удалить")}</span>
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </>
              ) : null}

              <button
                type="button"
                onClick={dismiss}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
                aria-label={t("Закрыть")}
              >
                <X size={19} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {storyViewerMoreOpen ? (
          <motion.button
            type="button"
            className="absolute inset-0 z-[9]"
            onClick={() => {
              setStoryViewerMoreOpen(false);
            }}
            aria-label={t("Закрыть меню истории")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        className="absolute bottom-24 left-0 top-24 z-[3] w-1/3 md:bottom-0 md:top-0"
        onClick={() => stepStoryViewer(-1)}
        aria-label={t("Предыдущая история")}
      />
      <button
        type="button"
        className="absolute bottom-24 right-0 top-24 z-[3] w-1/3 md:bottom-0 md:top-0"
        onClick={() => stepStoryViewer(1)}
        aria-label={t("Следующая история")}
      />

      <div
        className={cn(
          "flex h-full w-full items-center justify-center px-0 pt-0",
          "pb-0 md:pb-6",
        )}
      >
        <div className="flex h-full w-full items-center justify-center md:max-w-[430px]">
          <div
            className="relative flex h-full w-full max-w-none items-center justify-center overflow-hidden rounded-none md:h-[min(100%,820px)] md:max-w-[430px] md:rounded-[32px] md:shadow-[0_20px_70px_rgba(0,0,0,0.48)]"
            style={{ backgroundColor: clampStoryMediaTransform(activeStoryOverlay.media).bgColor ?? "#151515" }}
            onPointerDown={holdStoryViewer}
            onPointerUp={releaseStoryViewer}
            onPointerCancel={releaseStoryViewer}
            onPointerLeave={releaseStoryViewer}
          >
            {!mediaLoaded && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <Spinner className="h-9 w-9 text-white/70" />
              </div>
            )}
            {activeStory.mediaType === "video" ? (
              <video
                ref={storyViewerVideoRef}
                key={activeStory.id}
                src={activeStory.mediaUrl}
                className={cn("h-full w-full object-contain transition-opacity duration-200", mediaLoaded ? "opacity-100" : "opacity-0")}
                style={buildStoryMediaTransformStyle(activeStoryOverlay.media)}
                autoPlay
                playsInline
                controls={false}
                preload="auto"
                controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                onLoadedData={handleMediaReady}
                onCanPlay={handleMediaReady}
                onEnded={() => stepStoryViewer(1)}
              />
            ) : (
              <img
                key={activeStory.id}
                src={activeStory.mediaUrl}
                alt={activeStory.caption ?? activeStoryGroup.author.displayName}
                className={cn("h-full w-full object-contain transition-opacity duration-200", mediaLoaded ? "opacity-100" : "opacity-0")}
                style={buildStoryMediaTransformStyle(activeStoryOverlay.media)}
                decoding="async"
                loading="eager"
                onLoad={handleMediaReady}
              />
            )}
            <StoryDrawingCanvas overlay={activeStoryOverlay} />
            {activeStoryOverlay.texts && activeStoryOverlay.texts.map((layer) => {
              const bgStyle = layer.bgStyle ?? "none";
              const align = layer.align ?? "center";
              return (
                <div
                  key={layer.id}
                  className={cn(
                    "pointer-events-none absolute select-none whitespace-pre-wrap font-semibold max-w-[86%]",
                    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center",
                    bgStyle === "badge"
                      ? "bg-black/65 backdrop-blur-md rounded-2xl px-3.5 py-1.5 shadow-lg"
                      : bgStyle === "inverted"
                      ? "rounded-2xl px-3.5 py-1.5 shadow-lg font-bold"
                      : "px-2 py-1 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]",
                  )}
                  style={{
                    left: `${layer.x * 100}%`,
                    top: `${layer.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    backgroundColor: bgStyle === "inverted" ? layer.color : undefined,
                    color: bgStyle === "inverted" ? (layer.color.toLowerCase() === "#ffffff" ? "#000000" : "#ffffff") : layer.color,
                    fontSize: `${layer.size}px`,
                          ...(layer.kind !== "emoji" ? storyFontStyle(layer.font) : {}),
                    lineHeight: 1.25,
                  }}
                >
                  <StoryLayerContent layer={layer} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),14px)] md:px-6">
        <div className="mx-auto flex max-w-[430px] flex-col gap-3">
          {activeStory.caption?.trim() ? (
            <div data-story-scroll style={{ touchAction: "pan-y" }} className="max-h-[18dvh] overflow-y-auto rounded-[22px] bg-zinc-950/44 px-4 py-3 text-sm leading-6 text-white/94 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              {activeStory.caption}
            </div>
          ) : null}
          {activeStory.isMine ? null : (
            <div className="flex items-center gap-3">
              <div className="flex h-12 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#181818]/72 px-4 text-left text-sm text-zinc-300 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] md:h-11 md:gap-2 md:px-4">
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    openStoryAuthorDirect("");
                  }}
                  className="flex min-w-0 flex-1 items-center h-full w-full cursor-pointer"
                >
                  <span className="truncate text-[14px] text-white/65 md:text-[14px]">{t("Написать...")}</span>
                </button>
              </div>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleActiveStoryLike();
                }}
                disabled={storyLikePendingId === activeStory.id}
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] transition-all hover:bg-[#222224]/80 active:scale-95 cursor-pointer md:h-11 md:w-11",
                  activeStory.likedByMe ? "text-red-400 hover:text-red-300" : "text-white/90 hover:text-white",
                  storyLikePendingId === activeStory.id ? "opacity-70" : "",
                )}
                aria-label={t("Поставить лайк истории")}
              >
                <Heart size={21} fill={activeStory.likedByMe ? "currentColor" : "none"} className="md:h-5 md:w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {storyViewerStatsOpen && activeStory.isMine ? (
          <>
            <motion.button
              type="button"
              className="absolute inset-0 z-20 bg-black/40"
              onClick={() => {
                setStoryViewerStatsOpen(false);
                releaseStoryViewer();
              }}
              aria-label={t("Закрыть статистику просмотров")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md rounded-t-2xl border-t border-white/[0.08] bg-[#161618]/98 px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 shadow-[0_-16px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="font-sans text-[17px] font-semibold text-white/95">{t("Просмотры")}</p>
                </div>
              </div>
              <div className="max-h-[42dvh] space-y-1 overflow-y-auto pr-1 no-scrollbar">
                {storyViewerStatsFullLoading ? (
                  <div className="flex items-center justify-center py-10 text-zinc-400">
                    <Spinner className="h-5 w-5" />
                  </div>
                ) : storyViewerStats?.viewers.length ? (
                  storyViewerStats.viewers.map((viewer) => (
                    <div
                      key={`story-viewer-${viewer.id}-${viewer.viewedAt}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-white/[0.04]"
                    >
                      <div className="relative">
                        <MediaAvatar
                          src={viewer.avatarUrl ?? undefined}
                          alt={viewer.displayName}
                          className="h-10 w-10 ring-1 ring-white/10"
                          fallbackText={viewer.displayName.slice(0, 1)}
                          autoPlay
                        />
                        {viewer.liked ? (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-[2.5px] border-zinc-900 bg-red-500 shadow-sm">
                            <Heart size={9} fill="white" className="text-white" />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/90">{viewer.displayName}</p>
                        <p className="truncate text-[11px] font-medium text-zinc-500">@{viewer.link}</p>
                      </div>
                      <div className="shrink-0 text-xs font-medium text-zinc-400 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                        {formatMessageTimeLabel(viewer.viewedAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center px-4 py-10 text-center">
                    <p className="text-[13px] font-medium text-zinc-400">{t("Вашу историю никто не посмотрел")}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
