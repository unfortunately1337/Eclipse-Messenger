"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type StoryFeedGroup, type StoryFeedItem, type StoryReplyTarget, type ChatSummary, type ConversationChatType, type StoryViewerStats, type StoryDraft, type SelfProfile, type GroupModalData, type ChannelModalData } from "../types";
import { reactionModeLabel } from "../components/common/CommunityReactionsPanel";
import { CommunitySettingsPanel } from "../components/common/CommunitySettingsPanel";
import { ChangeEvent } from "react";
import { ChevronRight } from "lucide-react";
import { FaLink } from "react-icons/fa";
import { Spinner } from "@/components/ui/spinner";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { type EmojiComposerHandle } from "@/components/EmojiComposer";
import { makeMediaPreview, makeMediaPreviewDetails } from "@/lib/client/media-preview";
import { normalizeStoryOverlay } from "@/lib/story-overlay";
import { STORY_MAX_DURATION_MS, STORY_MAX_DURATION_SECONDS, STORY_MAX_FILE_BYTES, STORY_MAX_FILE_MB } from "@/lib/story-limits";
import { encryptMediaBlob } from "@/lib/client/media-crypto";
import { cacheMediaBlobUrl } from "@/lib/client/media-cache";
import { cacheStoryFeedSnapshot, loadInitialStoryFeedSnapshot, buildStoryFeedSignature, withOwnStory } from "./chat-cache";
import { filterDeletedStories, forgetDeletedStory, rememberDeletedStory } from "./story-deletions";
import { STORY_FEED_CACHE_TTL_MS } from "./config";
import { getVideoDurationMs } from "./media-recording";
import { optimizeStoryImageFile, resolveVideoAverageColor, resolveImageAverageColor } from "./media-files";

export interface RenderSecretChatPanelContentViewContext {
  secretChatLifetimeDays: number;
  secretChatLifetimeHours: number;
  secretChatLifetimeMinutes: number;
  renderSecretChatTimerControls: (isCompact?: boolean) => React.JSX.Element;
  submitCreateSecretChat: () => Promise<void>;
  secretChatCreating: boolean;
  secretChatSelectedUserIds: Set<string>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setSecretChatInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function renderSecretChatPanelContentView({ secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, renderSecretChatTimerControls, submitCreateSecretChat, secretChatCreating, secretChatSelectedUserIds, t, setSecretChatInfoOpen }: RenderSecretChatPanelContentViewContext): React.JSX.Element {
  const totalLifetimeSeconds =
    (secretChatLifetimeDays * 86400) +
    (secretChatLifetimeHours * 3600) +
    (secretChatLifetimeMinutes * 60);

  return (
    <div data-secret-chat-setup className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 py-4">
        {renderSecretChatTimerControls()}
      </div>

      {/* Action button */}
      <div data-secret-chat-setup-actions className="shrink-0 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void submitCreateSecretChat()}
          disabled={secretChatCreating || secretChatSelectedUserIds.size === 0 || totalLifetimeSeconds <= 0}
          className="w-full flex h-12 items-center justify-center rounded-[18px] bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast,#ffffff)] text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {secretChatCreating ? (
            <Spinner className="h-5 w-5" />
          ) : (
            <span>{t("Начать секретный чат")}</span>
          )}
        </button>
        <button type="button" onClick={() => setSecretChatInfoOpen(true)} className="mx-auto mt-3 block cursor-pointer bg-transparent px-2 py-1 text-[13px] font-medium text-zinc-400 transition-colors hover:text-zinc-100">{t("Как это работает?")}</button>
      </div>
    </div>
  );
}

export interface UploadMediaFileActionContext {
  voiceRecordedMimeTypeRef: React.RefObject<string | null>;
  videoRecordedMimeTypeRef: React.RefObject<string | null>;
}

export async function uploadMediaFileAction({ voiceRecordedMimeTypeRef, videoRecordedMimeTypeRef }: UploadMediaFileActionContext, file: Blob, kind: "image" | "video" | "voice" | "video_note" | "audio" | "file", durationMs?: number, scope?: { scopeType: string; scopeId: string; bot?: boolean }): Promise<{ id: string; url: string; expiresAt?: string | null | undefined; }> {
  const isAppleWebKit =
    typeof navigator !== "undefined" &&
    /AppleWebKit/i.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR|Firefox/i.test(navigator.userAgent);
  const fallbackType =
    kind === "voice"
      ? voiceRecordedMimeTypeRef.current || (isAppleWebKit ? "audio/mp4" : "audio/webm")
      : kind === "video_note"
        ? videoRecordedMimeTypeRef.current || (isAppleWebKit ? "video/mp4" : "video/webm")
        : kind === "audio"
          ? "audio/mpeg"
          : kind === "image"
            ? "image/jpeg"
            : "";
  const normalizedType = file.type?.trim() || fallbackType;
  const payloadBlob = !file.type && normalizedType ? file.slice(0, file.size, normalizedType) : file;
  const extensionByType = (() => {
    if (!normalizedType) return "";
    if (normalizedType.includes("audio/mpeg") || normalizedType.includes("audio/mp3")) return "mp3";
    if (normalizedType.includes("audio/wav") || normalizedType.includes("audio/x-wav")) return "wav";
    if (normalizedType.includes("audio/mp4")) return "m4a";
    if (normalizedType.includes("audio/webm")) return "webm";
    if (normalizedType.includes("audio/ogg")) return "ogg";
    if (normalizedType.includes("video/mp4")) return "mp4";
    if (normalizedType.includes("video/webm")) return "webm";
    if (normalizedType.includes("image/png")) return "png";
    if (normalizedType.includes("image/jpeg") || normalizedType.includes("image/jpg")) return "jpg";
    if (normalizedType.includes("image/webp")) return "webp";
    if (kind === "video_note") return isAppleWebKit ? "mp4" : "webm";
    if (kind === "voice") return isAppleWebKit ? "m4a" : "webm";
    return "";
  })();
  const form = new FormData();
  const safeName =
    file instanceof File && file.name
      ? file.name
      : `media-${Date.now()}${extensionByType ? `.${extensionByType}` : ""}`;
  // Attach the tiny first frame to the encrypted message envelope. It never
  // needs a public URL or a separate request.
  const previewPromise = scope && !scope.bot && (kind === "image" || kind === "video" || kind === "video_note")
    ? makeMediaPreviewDetails(payloadBlob, kind === "image" ? "image" : "video")
    : undefined;
  const encrypted = scope && !scope.bot ? await encryptMediaBlob(payloadBlob) : null;
  form.append("file", encrypted?.blob ?? payloadBlob, encrypted ? "encrypted.bin" : safeName);
  if (encrypted) form.append("clientEncrypted", "1");
  form.append("kind", kind);
  if (scope) { form.append("scopeType", scope.scopeType); form.append("scopeId", scope.scopeId); }
  if (typeof durationMs === "number") {
    form.append("durationMs", String(Math.max(0, Math.round(durationMs))));
  }
  const res = await apiRequest<{ id: string; url: string; expiresAt?: string | null }>("/api/media", {
    method: "POST",
    body: form,
    headers: {},
    timeoutMs: kind === "file" || kind === "video" || kind === "image" ? 10 * 60 * 1000 : 3 * 60 * 1000,
    // let fetch set multipart boundary
    skipCsrf: false,
  });
  return encrypted && scope ? { ...res, url: encrypted.protectUrl(res.url, `${scope.scopeType}:${scope.scopeId}`, res.expiresAt, { cacheOriginal: true, ...await previewPromise }) } : res;
}

export interface LoadStoriesActionContext {
  selfId: string | null;
  storyFeed: StoryFeedGroup[];
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  setStoriesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  storyFeedLoadPromiseRef: React.RefObject<Promise<void> | null>;
  storyFeedLoadIsForceRef: React.RefObject<boolean>;
}

export async function loadStoriesAction({ selfId, storyFeed, setStoryFeed, setStoriesLoading, storyFeedLoadPromiseRef, storyFeedLoadIsForceRef }: LoadStoriesActionContext, forceRefresh = false): Promise<void> {
  if (!selfId) return;
  const cached = loadInitialStoryFeedSnapshot(selfId);
  const cacheAgeMs = cached ? Date.now() - cached.savedAt : Number.POSITIVE_INFINITY;
  if (cached && storyFeed.length === 0) {
    setStoryFeed(cached.stories);
  }
  if (!forceRefresh && cached && cacheAgeMs <= STORY_FEED_CACHE_TTL_MS) {
    setStoriesLoading(false);
    return;
  }

  if (storyFeedLoadPromiseRef.current && !(forceRefresh && !storyFeedLoadIsForceRef.current)) {
    await storyFeedLoadPromiseRef.current;
    return;
  }

  const requestPromise = (async () => {
    setStoriesLoading(storyFeed.length === 0 && !cached);
    try {
      const data = await apiRequest<{ stories: StoryFeedGroup[] }>("/api/stories", { method: "GET" });
      const nextStories = filterDeletedStories(selfId, data.stories ?? []);
      setStoryFeed((prev) => (buildStoryFeedSignature(prev) === buildStoryFeedSignature(nextStories) ? prev : nextStories));
    } catch {
      if (!cached) {
        setStoryFeed([]);
      }
    } finally {
      setStoriesLoading(false);
    }
  })();

  storyFeedLoadPromiseRef.current = requestPromise;
  storyFeedLoadIsForceRef.current = forceRefresh;
  try {
    await requestPromise;
  } finally {
    if (storyFeedLoadPromiseRef.current === requestPromise) {
      storyFeedLoadPromiseRef.current = null;
      storyFeedLoadIsForceRef.current = false;
    }
  }
}

export interface PreloadAdjacentStoriesContext {
  activeStoryGroup: StoryFeedGroup | null;
  storyViewer: { groupIndex: number; storyIndex: number; startGroupIndex?: number | undefined; } | null;
  preloadedStoryUrlsRef: React.RefObject<Set<string>>;
  storyFeed: StoryFeedGroup[];
}

export function preloadAdjacentStories({ activeStoryGroup, storyViewer, preloadedStoryUrlsRef, storyFeed }: PreloadAdjacentStoriesContext): void {
  if (!activeStoryGroup || !storyViewer) return;

  const upcomingStories: Array<{ url: string; isVideo: boolean }> = [];

  // Next 2 stories in current group
  for (let i = 1; i <= 2; i++) {
    const story = activeStoryGroup.stories[storyViewer.storyIndex + i];
    if (story && !preloadedStoryUrlsRef.current.has(story.mediaUrl)) {
      upcomingStories.push({ url: story.mediaUrl, isVideo: story.mediaType === "video" });
    }
  }

  // First story of next group
  const nextGroup = storyFeed[(storyViewer.groupIndex + 1) % storyFeed.length];
  if (nextGroup?.stories[0] && !preloadedStoryUrlsRef.current.has(nextGroup.stories[0].mediaUrl)) {
    upcomingStories.push({ url: nextGroup.stories[0].mediaUrl, isVideo: nextGroup.stories[0].mediaType === "video" });
  }

  upcomingStories.forEach(({ url, isVideo }) => {
    preloadedStoryUrlsRef.current.add(url);
    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = url;
    } else {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = url;
    }
  });
}

export interface DeleteActiveStoryActionContext {
  selfId: string | null;
  activeStory: StoryFeedItem | null;
  publishedStoryFeed: StoryFeedGroup[];
  setStoryViewerMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  storyViewer: { groupIndex: number; storyIndex: number; startGroupIndex?: number | undefined; } | null;
  setStoryViewer: React.Dispatch<React.SetStateAction<{ groupIndex: number; storyIndex: number; startGroupIndex?: number | undefined; } | null>>;
  storyFeed: StoryFeedGroup[];
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export function deleteActiveStoryAction({ selfId, activeStory, publishedStoryFeed, setStoryViewerMoreOpen, setStoryFeed, setStoryViewer, storyFeed, setErrorText, t }: DeleteActiveStoryActionContext): void {
  if (!selfId || !activeStory?.isMine || activeStory.pendingUpload) return;
  const targetStoryId = activeStory.id;
  const previousGroup = publishedStoryFeed.find(group => group.stories.some(story => story.id === targetStoryId));
  rememberDeletedStory(selfId, targetStoryId, activeStory.expiresAt);
  cacheStoryFeedSnapshot(selfId, publishedStoryFeed);

  setStoryViewerMoreOpen(false);

  // 1. Optimistically update feed immediately
  setStoryFeed(prev => filterDeletedStories(selfId, prev));

  // 2. Optimistically advance or close viewer immediately
  setStoryViewer((prev) => {
    if (!prev) return prev;
    const nextFeed = filterDeletedStories(selfId, storyFeed);
    const currentGroup = storyFeed[prev.groupIndex];
    if (!currentGroup) return null;
    const nextGroupIndex = nextFeed.findIndex(group => group.author.id === currentGroup.author.id);
    if (nextGroupIndex >= 0) {
      return {
        groupIndex: nextGroupIndex,
        storyIndex: Math.max(0, Math.min(prev.storyIndex, nextFeed[nextGroupIndex]!.stories.length - 1)),
      };
    }
    const fallbackGroupIndex = Math.min(prev.groupIndex, nextFeed.length - 1);
    return fallbackGroupIndex >= 0 ? { groupIndex: fallbackGroupIndex, storyIndex: 0 } : null;
  });

  // 3. Fire delete request in background without blocking UI
  void (async () => {
    let leavingPage = false;
    const onPageLeave = () => { leavingPage = true; };
    window.addEventListener("beforeunload", onPageLeave);
    window.addEventListener("pagehide", onPageLeave);
    try {
      await apiRequest(`/api/stories/${encodeURIComponent(targetStoryId)}`, {
        method: "DELETE",
        keepalive: true,
      });
    } catch (error) {
      // Navigating away does not mean the server rejected the deletion. Keep the
      // tombstone so a stale bootstrap cannot resurrect the story on reload.
      if (leavingPage || (error instanceof DOMException && error.name === "AbortError")) return;
      forgetDeletedStory(selfId, targetStoryId);
      if (previousGroup) {
        // Restore just this story; do not overwrite uploads or likes received in the meantime.
        setStoryFeed(prev => withOwnStory(prev, previousGroup.author, activeStory));
        const cached = loadInitialStoryFeedSnapshot(selfId)?.stories ?? [];
        cacheStoryFeedSnapshot(selfId, withOwnStory(cached, previousGroup.author, activeStory));
      }
      setErrorText(error instanceof Error ? error.message : t("Не удалось удалить историю"));
    } finally {
      window.removeEventListener("beforeunload", onPageLeave);
      window.removeEventListener("pagehide", onPageLeave);
    }
  })();
}

export interface OpenStoryAuthorDirectActionContext {
  activeStoryGroup: StoryFeedGroup | null;
  selfId: string | null;
  activeStory: StoryFeedItem | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  activeChat: ChatSummary | null;
  selectedLink: string | null;
  closeStoryViewer: () => void;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
  messageInputRef: React.RefObject<EmojiComposerHandle | null>;
}

export async function openStoryAuthorDirectAction({ activeStoryGroup, selfId, activeStory, t, setReplyToMessageId, setMessageText, setStoryReplyTarget, activeChat, selectedLink, closeStoryViewer, setSelectedLink, openConversationRef, messageInputRef }: OpenStoryAuthorDirectActionContext, prefill = ""): Promise<void> {
  const link = activeStoryGroup?.author.link;
  const authorId = activeStoryGroup?.author.id;
  if (!link || !authorId || authorId === selfId) return;
  const previewText = activeStory?.caption?.trim() || "";
  const nextStoryReplyTarget: StoryReplyTarget = {
    storyId: activeStory?.id ?? "",
    authorName: activeStoryGroup?.author.displayName ?? t("История"),
    previewText,
    isOwn: activeStoryGroup?.author.id === selfId,
  };
  setReplyToMessageId(null);
  setMessageText(prefill);
  setStoryReplyTarget(nextStoryReplyTarget);
  const alreadyOpenDirect =
    activeChat?.chatType === "direct" &&
    activeChat.peerId === authorId &&
    selectedLink === link;
  closeStoryViewer();
  if (!alreadyOpenDirect) {
    setSelectedLink(link);
  }
  try {
    if (!alreadyOpenDirect) {
      await openConversationRef.current(link, { force: true, chatType: "direct" });
    }
  } catch {
    // opening from story is best-effort
  }
  window.setTimeout(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.setSelectionRange(prefill.length, prefill.length);
    } catch {
      // ignore
    }
  }, 160);
}

export interface ToggleActiveStoryLikeActionContext {
  activeStory: StoryFeedItem | null;
  storyLikePendingId: string | null;
  setStoryLikePendingId: React.Dispatch<React.SetStateAction<string | null>>;
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  storyViewer: { groupIndex: number; storyIndex: number; startGroupIndex?: number | undefined; } | null;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function toggleActiveStoryLikeAction({ activeStory, storyLikePendingId, setStoryLikePendingId, setStoryFeed, storyViewer, setErrorText, t }: ToggleActiveStoryLikeActionContext): Promise<void> {
  if (!activeStory?.id || activeStory.isMine) return;
  if (storyLikePendingId === activeStory.id) return;

  const nextLiked = !activeStory.likedByMe;
  const previousLiked = activeStory.likedByMe;
  const previousCount = activeStory.likesCount;

  setStoryLikePendingId(activeStory.id);
  setStoryFeed((prev) =>
    prev.map((group, groupIndex) =>
      groupIndex !== (storyViewer?.groupIndex ?? -1)
        ? group
        : {
          ...group,
          stories: group.stories.map((story, storyIndex) =>
            storyIndex !== (storyViewer?.storyIndex ?? -1) || story.id !== activeStory.id
              ? story
              : {
                ...story,
                likedByMe: nextLiked,
                likesCount: Math.max(0, previousCount + (nextLiked ? 1 : -1)),
              },
          ),
        },
    ),
  );

  try {
    const response = await apiRequest<{ liked: boolean; likesCount: number }>(
      `/api/stories/${encodeURIComponent(activeStory.id)}/like`,
      {
        method: nextLiked ? "POST" : "DELETE",
      },
    );
    setStoryFeed((prev) =>
      prev.map((group) => ({
        ...group,
        stories: group.stories.map((story) =>
          story.id !== activeStory.id
            ? story
            : {
              ...story,
              likedByMe: response.liked,
              likesCount: response.likesCount,
            },
        ),
      })),
    );
  } catch (error) {
    setStoryFeed((prev) =>
      prev.map((group) => ({
        ...group,
        stories: group.stories.map((story) =>
          story.id !== activeStory.id
            ? story
            : {
              ...story,
              likedByMe: previousLiked,
              likesCount: previousCount,
            },
        ),
      })),
    );
    setErrorText(error instanceof Error ? error.message : t("Не удалось поставить лайк на историю"));
  } finally {
    setStoryLikePendingId((current) => (current === activeStory.id ? null : current));
  }
}

export interface LoadActiveStoryViewersActionContext {
  activeStory: StoryFeedItem | null;
  setStoryViewerStatsFullLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setStoryViewerStatsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setStoryViewerStats: React.Dispatch<React.SetStateAction<StoryViewerStats | null>>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function loadActiveStoryViewersAction({ activeStory, setStoryViewerStatsFullLoading, setStoryViewerStatsLoading, setStoryViewerStats, setErrorText, t }: LoadActiveStoryViewersActionContext, full = false): Promise<void> {
  if (!activeStory?.id || !activeStory.isMine || activeStory.pendingUpload) return;
  if (full) {
    setStoryViewerStatsFullLoading(true);
  } else {
    setStoryViewerStatsLoading(true);
  }
  try {
    const query = full ? "" : "?limit=3";
    const data = await apiRequest<StoryViewerStats>(
      `/api/stories/${encodeURIComponent(activeStory.id)}/viewers${query}`,
      { method: "GET" },
    );
    setStoryViewerStats(data);
  } catch (error) {
    if (full) {
      setErrorText(error instanceof Error ? error.message : t("Не удалось загрузить просмотры истории"));
    }
  } finally {
    setStoryViewerStatsLoading(false);
    setStoryViewerStatsFullLoading(false);
  }
}

export interface RunStoryPlaybackContext {
  storyProgressRafRef: React.RefObject<number | null>;
  activeStory: StoryFeedItem | null;
  storyViewer: { groupIndex: number; storyIndex: number; startGroupIndex?: number | undefined; } | null;
  storyAdvanceTimerRef: React.RefObject<number | null>;
  storyViewerPaused: boolean;
  storyViewerInteractionLocked: boolean;
  storyImageProgressStoryIdRef: React.RefObject<string | null>;
  storyImageProgressElapsedRef: React.RefObject<number>;
  storyMediaReady: boolean;
  storyViewerProgressRef: React.RefObject<number>;
  stepStoryViewer: (direction: 1 | -1) => void;
}

export function runStoryPlayback({ storyProgressRafRef, activeStory, storyViewer, storyAdvanceTimerRef, storyViewerPaused, storyViewerInteractionLocked, storyImageProgressStoryIdRef, storyImageProgressElapsedRef, storyMediaReady, storyViewerProgressRef, stepStoryViewer }: RunStoryPlaybackContext): (() => void) | undefined {
  if (storyProgressRafRef.current) {
    cancelAnimationFrame(storyProgressRafRef.current);
    storyProgressRafRef.current = null;
  }
  if (!activeStory || !storyViewer) {

    return;
  }
  if (storyAdvanceTimerRef.current) {
    window.clearTimeout(storyAdvanceTimerRef.current);
    storyAdvanceTimerRef.current = null;
  }
  if (storyViewerPaused || storyViewerInteractionLocked) return;
  if (activeStory.mediaType !== "image") {

    storyImageProgressStoryIdRef.current = null;
    storyImageProgressElapsedRef.current = 0;
    return;
  }
  if (!storyMediaReady) return;
  const durationMs = 5000;
  if (storyImageProgressStoryIdRef.current !== activeStory.id) {
    storyImageProgressStoryIdRef.current = activeStory.id;
    storyImageProgressElapsedRef.current = 0;
    storyViewerProgressRef.current = 0;

  }
  const startedAt = performance.now() - storyImageProgressElapsedRef.current;
  const tick = () => {
    const now = performance.now();
    const elapsed = now - startedAt;
    storyImageProgressElapsedRef.current = elapsed;
    const nextProgress = Math.max(0, Math.min(1, elapsed / durationMs));
    storyViewerProgressRef.current = nextProgress;
    if (nextProgress < 1) {
      storyProgressRafRef.current = requestAnimationFrame(tick);
    }
  };
  storyProgressRafRef.current = requestAnimationFrame(tick);
  const remainingMs = Math.max(0, durationMs - storyImageProgressElapsedRef.current);
  storyAdvanceTimerRef.current = window.setTimeout(() => {
    storyImageProgressElapsedRef.current = durationMs;
    storyViewerProgressRef.current = 1;
    stepStoryViewer(1);
  }, remainingMs);
  return () => {
    if (storyAdvanceTimerRef.current) {
      window.clearTimeout(storyAdvanceTimerRef.current);
      storyAdvanceTimerRef.current = null;
    }
    if (storyProgressRafRef.current) {
      cancelAnimationFrame(storyProgressRafRef.current);
      storyProgressRafRef.current = null;
    }
  };
}

export interface BindStoryVideoPlaybackContext {
  activeStory: StoryFeedItem | null;
  storyViewerVideoRef: React.RefObject<HTMLVideoElement | null>;
  storyViewerProgressRef: React.RefObject<number>;
}

export function bindStoryVideoPlayback({ activeStory, storyViewerVideoRef, storyViewerProgressRef }: BindStoryVideoPlaybackContext): (() => void) | undefined {
  if (!activeStory || activeStory.mediaType !== "video") return;
  const video = storyViewerVideoRef.current;
  if (!video) return;

  const syncProgress = () => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (duration <= 0) {
      if (storyViewerProgressRef.current !== 0) {
        storyViewerProgressRef.current = 0;

      }
      return;
    }
    storyViewerProgressRef.current = Math.max(0, Math.min(1, video.currentTime / duration));
  };

  const resetProgress = () => {
    storyViewerProgressRef.current = 0;

  };
  syncProgress();
  video.addEventListener("timeupdate", syncProgress);
  video.addEventListener("loadedmetadata", syncProgress);
  video.addEventListener("emptied", resetProgress);

  return () => {
    video.removeEventListener("timeupdate", syncProgress);
    video.removeEventListener("loadedmetadata", syncProgress);
    video.removeEventListener("emptied", resetProgress);
  };
}

export interface PrepareStoryDraftActionContext {
  storyUploading: boolean;
  setStoryCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setErrorText: (message: string | null) => void;
  setStoryDraft: React.Dispatch<React.SetStateAction<StoryDraft | null>>;
}

export async function prepareStoryDraftAction({ storyUploading, setStoryCameraOpen, t, setErrorText, setStoryDraft }: PrepareStoryDraftActionContext, file: File, mediaType: "image" | "video", recordedDurationMs?: number): Promise<void> {
  if (storyUploading) return;
  setStoryCameraOpen(false);
  if (file.size > STORY_MAX_FILE_BYTES) {
    showAppToast({ title: t("Файл слишком большой. Максимум {0} МБ.", { 0: STORY_MAX_FILE_MB }), type: "error" });
    return;
  }
  try {
    setErrorText(null);
    const isVideo = mediaType === "video";
    const durationMs = isVideo ? recordedDurationMs || await getVideoDurationMs(file) : 0;
    if (isVideo && !durationMs) {
      showAppToast({ title: t("Не удалось определить длительность видео"), type: "error" });
      return;
    }
    if (durationMs > STORY_MAX_DURATION_MS) {
      showAppToast({ title: t("История с видео может быть не длиннее {0} секунд", { 0: STORY_MAX_DURATION_SECONDS }), type: "error" });
      return;
    }
    const storyFile = isVideo ? file : await optimizeStoryImageFile(file);
    const mediaBgColor = isVideo ? await resolveVideoAverageColor(storyFile) : await resolveImageAverageColor(storyFile);
    setStoryDraft({
      file: storyFile,
      previewUrl: URL.createObjectURL(storyFile),
      mediaType,
      durationMs,
      caption: "",
      ttlHours: 24,
      overlay: { media: { scale: 1, x: 0, y: 0, bgColor: mediaBgColor }, texts: [], strokes: [] },
    });
  } catch (error) {
    showAppToast({ title: t("Не удалось обработать медиа для истории"), description: error instanceof Error ? error.message : undefined, type: "error" });
  }
}

export interface SubmitStoryDraftActionContext {
  storyDraft: StoryDraft | null;
  selfProfile: SelfProfile | null;
  pendingStoryUploadRef: React.RefObject<string | null>;
  selfStoryGroup: StoryFeedGroup | null;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setPendingStory: React.Dispatch<React.SetStateAction<{ author: { id: string; link: string; displayName: string; avatarUrl?: string | null | undefined; }; story: StoryFeedItem; } | null>>;
  closeStoryDraft: () => void;
  setStoryUploading: React.Dispatch<React.SetStateAction<boolean>>;
  setAnimateSelfStoryRing: React.Dispatch<React.SetStateAction<boolean>>;
  uploadMediaFile: (file: Blob, kind: "image" | "video" | "voice" | "file" | "audio" | "video_note", durationMs?: number | undefined, scope?: { scopeType: string; scopeId: string; bot?: boolean | undefined; } | undefined) => Promise<{ id: string; url: string; expiresAt?: string | null | undefined; }>;
  storyAccountRef: React.RefObject<string | null>;
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  visibleStoryIdRef: React.RefObject<string | null>;
  closeStoryViewer: () => void;
  setStoryDraft: React.Dispatch<React.SetStateAction<StoryDraft | null>>;
}

export async function submitStoryDraftAction({ storyDraft, selfProfile, pendingStoryUploadRef, selfStoryGroup, setErrorText, t, setPendingStory, closeStoryDraft, setStoryUploading, setAnimateSelfStoryRing, uploadMediaFile, storyAccountRef, setStoryFeed, visibleStoryIdRef, closeStoryViewer, setStoryDraft }: SubmitStoryDraftActionContext, editedDraft?: StoryDraft): Promise<void> {
  const draft = editedDraft ?? storyDraft;
  if (!draft || !selfProfile || pendingStoryUploadRef.current) return;
  if (selfStoryGroup && selfStoryGroup.stories.length >= 6) {
    setErrorText(t("Превышен лимит: вы не можете опубликовать более 6 активных историй."));
    return;
  }

  const author = {
    id: selfProfile.id,
    link: selfProfile.link,
    displayName: selfProfile.displayName,
    avatarUrl: selfProfile.avatarUrl ?? null,
  };
  const pendingId = `pending:${crypto.randomUUID()}`;
  const localUrl = URL.createObjectURL(draft.file);
  const now = Date.now();
  const localStory: StoryFeedItem = {
    id: pendingId,
    pendingUpload: true,
    mediaUrl: localUrl,
    mediaType: draft.mediaType,
    durationMs: draft.mediaType === "video" ? draft.durationMs : null,
    caption: draft.caption.trim() || null,
    overlay: draft.overlay,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + draft.ttlHours * 3600_000).toISOString(),
    viewed: false,
    isMine: true,
    viewsCount: 0,
    viewersPreview: [],
    likedByMe: false,
    likesCount: 0,
  };
  pendingStoryUploadRef.current = pendingId;
  setPendingStory({ author, story: localStory });
  closeStoryDraft();
  setStoryUploading(true);
  setAnimateSelfStoryRing(true);
  setErrorText(null);

  let keepLocalUrl = false;
  try {
    const [uploaded, preview] = await Promise.all([
      uploadMediaFile(draft.file, draft.mediaType, localStory.durationMs ?? undefined),
      makeMediaPreview(draft.file, draft.mediaType),
    ]);
    if (storyAccountRef.current !== author.id) return;
    const created = await apiRequest<{ story: Pick<StoryFeedItem, "id" | "mediaUrl" | "mediaType" | "durationMs" | "caption" | "overlay" | "createdAt" | "expiresAt"> }>("/api/stories", {
      method: "POST",
      body: JSON.stringify({
        mediaUrl: uploaded.url,
        mediaType: draft.mediaType,
        durationMs: localStory.durationMs,
        ttlHours: draft.ttlHours,
        caption: localStory.caption,
        overlay: { ...draft.overlay, preview },
      }),
    });
    if (storyAccountRef.current !== author.id) return;
    cacheMediaBlobUrl(created.story.mediaUrl, localUrl);
    keepLocalUrl = true;
    const published: StoryFeedItem = {
      ...localStory,
      ...created.story,
      pendingUpload: false,
      overlay: normalizeStoryOverlay(created.story.overlay),
    };
    setStoryFeed(prev => withOwnStory(prev, author, published));
    showAppToast({ title: t("История опубликована"), type: "success" });
  } catch (error) {
    if (storyAccountRef.current !== author.id) return;
    if (visibleStoryIdRef.current === pendingId) closeStoryViewer();
    setStoryDraft({ ...draft, previewUrl: URL.createObjectURL(draft.file) });
    showAppToast({
      title: t("Не удалось опубликовать историю"),
      description: error instanceof Error ? error.message : t("Ошибка загрузки"),
      type: "error",
    });
  } finally {
    if (!keepLocalUrl) URL.revokeObjectURL(localUrl);
    pendingStoryUploadRef.current = null;
    setPendingStory(null);
    setStoryUploading(false);
    setAnimateSelfStoryRing(false);
  }
}

export interface RenderCommunitySettingsViewContext {
  groupModalData: GroupModalData | null;
  channelModalData: ChannelModalData | null;
  selfId: string | null;
  openInviteModal: (kind: "group" | "channel", link: string) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  groupNameDraft: string;
  channelNameDraft: string;
  groupDescriptionDraft: string;
  channelDescriptionDraft: string;
  groupAvatarDraft: string | null;
  channelAvatarDraft: string | null;
  openCommunityReactions: (kind: "group" | "channel") => void;
  setGroupNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setChannelNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setGroupDescriptionDraft: React.Dispatch<React.SetStateAction<string>>;
  setChannelDescriptionDraft: React.Dispatch<React.SetStateAction<string>>;
  groupAvatarInputRef: React.RefObject<HTMLInputElement | null>;
  channelAvatarInputRef: React.RefObject<HTMLInputElement | null>;
  openCommunityType: (kind: "group" | "channel") => void;
  groupMembersReturnViewRef: React.RefObject<"settings" | null>;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  channelMembersReturnViewRef: React.RefObject<"settings" | null>;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  onGroupAvatarSelected: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  onChannelAvatarSelected: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
}

export function renderCommunitySettingsView({ groupModalData, channelModalData, selfId, openInviteModal, t, groupNameDraft, channelNameDraft, groupDescriptionDraft, channelDescriptionDraft, groupAvatarDraft, channelAvatarDraft, openCommunityReactions, setGroupNameDraft, setChannelNameDraft, setGroupDescriptionDraft, setChannelDescriptionDraft, groupAvatarInputRef, channelAvatarInputRef, openCommunityType, groupMembersReturnViewRef, setGroupSubView, channelMembersReturnViewRef, setChannelSubView, onGroupAvatarSelected, onChannelAvatarSelected }: RenderCommunitySettingsViewContext, kind: "group" | "channel"): React.JSX.Element | null {
  const group = kind === "group", entity = group ? groupModalData?.group : channelModalData?.channel;
  if (!entity) return null;
  const owner = entity.ownerId === selfId;
  const members = group ? (groupModalData?.members ?? []) : (channelModalData?.subscribers ?? channelModalData?.members ?? []);
  return <CommunitySettingsPanel kind={kind} hasRealAvatar={Boolean(group ? groupModalData?.group.avatarUrl : channelModalData?.channel.avatarUrl)} inviteControl={(owner || Boolean(entity.myCanGenerateInviteLink)) && (
    <button type="button" onClick={() => openInviteModal(kind, entity.link)} className="flex min-h-14 w-full items-center gap-3.5 rounded-[18px] px-4 py-3 text-left transition-colors hover:bg-white/[0.06]">
      <FaLink size={20} className="shrink-0 text-zinc-400" /><span className="min-w-0 flex-1 text-[15px] font-semibold text-zinc-100">{t("Ссылки приглашения")}</span><ChevronRight size={17} className="text-zinc-500" />
    </button>
  )}
    name={group ? groupNameDraft : channelNameDraft} description={group ? groupDescriptionDraft : channelDescriptionDraft}
    avatarUrl={group ? groupAvatarDraft : channelAvatarDraft} isPublic={Boolean(entity.isPublic)}
    canEditName={owner || Boolean(entity.myCanChangeName)} canEditAvatar={owner || Boolean(entity.myCanChangeAvatar)}
    canEditReactions={owner || (entity.myRole === "admin" && Boolean(entity.myCanChangeReactions))}
    reactionsLabel={t(reactionModeLabel(entity.reactionMode))} onReactions={() => openCommunityReactions(kind)}
    canEditType={owner} canManageAdmins={owner || Boolean(entity.myCanManageAdmins)}
    membersCount={group ? members.length : (channelModalData?.channel.subscribersCount ?? "0")}
    adminsCount={members.filter(member => member.role === "admin" || member.id === entity.ownerId).length}
    onNameChange={group ? setGroupNameDraft : setChannelNameDraft}
    onDescriptionChange={group ? setGroupDescriptionDraft : setChannelDescriptionDraft}
    onAvatarChange={() => (group ? groupAvatarInputRef : channelAvatarInputRef).current?.click()}
    onType={() => openCommunityType(kind)}
    onMembers={() => { if (group) { groupMembersReturnViewRef.current = "settings"; setGroupSubView("members"); } else { channelMembersReturnViewRef.current = "settings"; setChannelSubView("subscribers"); } }}
    onAdmins={() => { if (group) { groupMembersReturnViewRef.current = "settings"; setGroupSubView("admins"); } else { channelMembersReturnViewRef.current = "settings"; setChannelSubView("admins"); } }}
    avatarInput={<input ref={group ? groupAvatarInputRef : channelAvatarInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={event => void (group ? onGroupAvatarSelected(event) : onChannelAvatarSelected(event))} />}
  />;
}
