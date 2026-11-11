"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";

import { apiRequest } from "@/lib/client/http";

import { normalizeStoryOverlay } from "@/lib/story-overlay";

import { getCachedMediaUrl } from "@/lib/client/media-cache";
import { type StoryFeedGroup, type StoryFeedCacheSnapshot } from "../../types";

import { stepStoryPosition } from "@/lib/client/story-navigation";

import { storyFeedInMemoryCache, saveStoryFeedSessionCache, saveStoryFeedPersistentCache } from "../chat-cache";

import { STORY_FEED_POLL_INTERVAL_MS } from "../config";

import { hashSeed } from "../message-format";

import { loadStoryViewerModule } from "../lazy-panels";

import {
  preloadAdjacentStories,
  deleteActiveStoryAction,
  openStoryAuthorDirectAction,
  toggleActiveStoryLikeAction,
  loadActiveStoryViewersAction,
  runStoryPlayback,
  bindStoryVideoPlayback
} from "../story-actions";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ProfileDetailsModel } from "./useProfileDetails";
import type { ActiveConversationModel } from "./useActiveConversation";

export interface ChatStoriesSources {
  page: Pick<ChatPageStateModel, "storyFeed" | "settingsPanelOpen" | "setErrorText" | "t" | "router"> & {
    account: Pick<ChatPageStateModel["account"], "selfId">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyViewer" | "publishedStoryFeed" | "preloadedStoryUrlsRef" | "setStoryMediaReady" | "visibleStoryIdRef" | "storyViewerStatsOpen" | "storyViewerMoreOpen" | "setStoryViewerPaused" | "setStoryViewerStatsOpen" | "setStoryViewerMoreOpen" | "setStoryViewerStats" | "setStoryViewer" | "setStoryViewerOrigin" | "setStoryFeed" | "setStoryReplyTarget" | "storyLikePendingId" | "setStoryLikePendingId" | "setStoryViewerStatsFullLoading" | "setStoryViewerStatsLoading" | "viewedStoryIdsRef" | "storyViewerPaused" | "storyMediaReady" | "storyDraft" | "setStoryDraft">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "setReplyToMessageId">;
    selection: Pick<ChatPageStateModel["selection"], "setMessageText" | "selectedLink" | "setSelectedLink">;

  };
  elements: {
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "storyDraftRef" | "storyAdvanceTimerRef" | "storyProgressRafRef" | "storyViewerVideoRef" | "storyImageProgressStoryIdRef" | "storyImageProgressElapsedRef" | "storyViewerProgressRef" | "messageInputRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "openConversationRef">;

  };
  details: Pick<ProfileDetailsModel, "loadStories">;
  active: Pick<ActiveConversationModel, "activeChat">;
}

export interface ChatStoriesModel {
  markStoryMediaReady: () => void;
  activeStoryGroup: import("@/app/app/(chats)/types").StoryFeedGroup | null;
  activeStory: import("@/app/app/(chats)/types").StoryFeedItem | null;
  selfStoryGroup: import("@/app/app/(chats)/types").StoryFeedGroup | null;
  selfGroupIndex: number;
  storyGroupByAuthorId: Map<string, {
    group: import("@/app/app/(chats)/types").StoryFeedGroup;
    index: number;

  }>;
  compactStoryGroups: import("@/app/app/(chats)/types").StoryFeedGroup[];
  mobileStoryRailGroups: import("@/app/app/(chats)/types").StoryFeedGroup[];
  activeChatStoryEntry: {
    group: import("@/app/app/(chats)/types").StoryFeedGroup;
    index: number;

  } | null;
  closeStoryViewer: () => void;
  openStoryViewer: (groupIndex: number, storyIndex?: number, source?: HTMLElement | null | undefined) => void;
  openStoryViewerByAuthorId: (authorId: string, source?: HTMLElement | null | undefined) => void;
  deleteActiveStory: () => void;
  stepStoryViewer: (direction: 1 | -1) => void;
  openStoryAuthorDirect: (prefill?: string) => Promise<void>;
  toggleActiveStoryLike: () => Promise<void>;
  loadActiveStoryViewers: (full?: boolean) => Promise<void>;
  holdStoryViewer: () => void;
  releaseStoryViewer: () => void;
  closeStoryDraft: () => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatStories(sources: ChatStoriesSources): ChatStoriesModel {
  const { storyFeed, settingsPanelOpen, setErrorText, t, router } = sources.page;
  const { selfId } = sources.page.account;
  const { storyViewer, publishedStoryFeed, preloadedStoryUrlsRef, setStoryMediaReady, visibleStoryIdRef, storyViewerStatsOpen, storyViewerMoreOpen, setStoryViewerPaused, setStoryViewerStatsOpen, setStoryViewerMoreOpen, setStoryViewerStats, setStoryViewer, setStoryViewerOrigin, setStoryFeed, setStoryReplyTarget, storyLikePendingId, setStoryLikePendingId, setStoryViewerStatsFullLoading, setStoryViewerStatsLoading, viewedStoryIdsRef, storyViewerPaused, storyMediaReady, storyDraft, setStoryDraft } = sources.page.storyDraft;
  const { setReplyToMessageId } = sources.page.composerInteraction;
  const { setMessageText, selectedLink, setSelectedLink } = sources.page.selection;
  const { storyDraftRef, storyAdvanceTimerRef, storyProgressRafRef, storyViewerVideoRef, storyImageProgressStoryIdRef, storyImageProgressElapsedRef, storyViewerProgressRef, messageInputRef } = sources.elements.storyAndViewport;
  const { openConversationRef } = sources.elements.conversationRequest;
  const { loadStories } = sources.details;
  const { activeChat } = sources.active;

  useEffect(() => {
    if (!selfId) return;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      if (storyDraftRef.current || storyViewer) return;
      void loadStories(true);
    }, STORY_FEED_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadStories, selfId, storyViewer]);

  useEffect(() => {
    if (!selfId || publishedStoryFeed.length === 0) return;
    const snapshot: StoryFeedCacheSnapshot = {
      savedAt: Date.now(),
      stories: publishedStoryFeed,
    };
    storyFeedInMemoryCache.set(selfId, snapshot);
    saveStoryFeedSessionCache(selfId, snapshot);
    saveStoryFeedPersistentCache(selfId, snapshot);
  }, [selfId, publishedStoryFeed]);

  useEffect(() => {
    if (storyFeed.length) {
      const timer = window.setTimeout(() => { void loadStoryViewerModule().catch(() => { }); }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [Boolean(storyFeed.length)]);

  useEffect(() => { if (settingsPanelOpen) void loadStories(true); }, [settingsPanelOpen, loadStories]);

  useEffect(() => {
    if (!storyFeed || storyFeed.length === 0) return;

    const candidateUrls: Array<{
      url: string;
      isVideo: boolean

    }> = [];
    storyFeed.forEach((group) => {
      group.stories.slice(0, 2).forEach((story) => {
        if (!story.pendingUpload && getCachedMediaUrl(story.mediaUrl) === story.mediaUrl && !preloadedStoryUrlsRef.current.has(story.mediaUrl)) {
          candidateUrls.push({ url: story.mediaUrl, isVideo: story.mediaType === "video" });
        }
      });
    });

    candidateUrls.slice(0, 6).forEach(({ url, isVideo }) => {
      preloadedStoryUrlsRef.current.add(url);
      if (isVideo) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = url;
      } else {
        const image = new Image();
        image.decoding = "async";
        image.loading = "eager";
        image.src = url;
      }
    });
  }, [storyFeed]);

  const markStoryMediaReady = useCallback(() => setStoryMediaReady(true), []);

  const activeStoryGroup = storyViewer ? storyFeed[storyViewer.groupIndex] ?? null : null;

  const activeStory = activeStoryGroup ? activeStoryGroup.stories[storyViewer?.storyIndex ?? -1] ?? null : null;

  useLayoutEffect(() => { visibleStoryIdRef.current = activeStory?.id ?? null; }, [activeStory?.id]);

  const activeStoryOverlay = useMemo(() => normalizeStoryOverlay(activeStory?.overlay), [activeStory?.overlay]);

  const storyViewerInteractionLocked = storyViewerStatsOpen || storyViewerMoreOpen;

  const selfStoryGroup = useMemo(
    () => (selfId ? storyFeed.find((group) => group.author.id === selfId) ?? null : null),
    [selfId, storyFeed],
  );

  const selfGroupIndex = useMemo(
    () => (selfId ? storyFeed.findIndex((group) => group.author.id === selfId) : -1),
    [selfId, storyFeed],
  );

  const visibleStoryFeed = useMemo(
    () => storyFeed.filter((group) => group.author.id !== selfId),
    [selfId, storyFeed],
  );

  const storyGroupByAuthorId = useMemo(() => {
    const map = new Map<string, {
      group: StoryFeedGroup;
      index: number

    }>();
    storyFeed.forEach((group, index) => {
      map.set(group.author.id, { group, index });
    });
    return map;
  }, [storyFeed]);

  const compactStoryGroups = useMemo(() => {
    const seen = new Set<string>();
    const ordered = storyFeed
      .filter((group) => group.stories.length > 0 && group.author.id !== selfId)
      .sort(
        (left, right) =>
          hashSeed(`${selfId ?? "stories"}:${left.author.id}`) -
          hashSeed(`${selfId ?? "stories"}:${right.author.id}`),
      );
    const result: StoryFeedGroup[] = [];
    for (const group of ordered) {
      if (seen.has(group.author.id)) continue;
      seen.add(group.author.id);
      result.push(group);
      if (result.length >= 3) break;
    }
    return result;
  }, [storyFeed, selfId]);

  const mobileStoryRailGroups = useMemo(() => visibleStoryFeed.slice(0, 5), [visibleStoryFeed]);

  const activeChatStoryEntry =
    activeChat?.chatType === "direct" ? storyGroupByAuthorId.get(activeChat.peerId) ?? null : null;

  useEffect(() => {
    return preloadAdjacentStories({ activeStoryGroup, storyViewer, preloadedStoryUrlsRef, storyFeed });
  }, [activeStoryGroup, storyViewer, storyFeed]);

  const closeStoryViewer = useCallback(() => {
    if (storyAdvanceTimerRef.current) {
      window.clearTimeout(storyAdvanceTimerRef.current);
      storyAdvanceTimerRef.current = null;
    }
    if (storyProgressRafRef.current) {
      cancelAnimationFrame(storyProgressRafRef.current);
      storyProgressRafRef.current = null;
    }
    const video = storyViewerVideoRef.current;
    if (video) {
      video.pause();
    }
    storyImageProgressStoryIdRef.current = null;
    storyImageProgressElapsedRef.current = 0;
    storyViewerProgressRef.current = 0;
    setStoryViewerPaused(false);

    setStoryMediaReady(false);
    setStoryViewerStatsOpen(false);
    setStoryViewerMoreOpen(false);
    setStoryViewerStats(null);
    setStoryViewer(null);
  }, []);

  const openStoryViewer = useCallback((groupIndex: number, storyIndex = 0, source?: HTMLElement | null) => {
    const rect = source?.getBoundingClientRect();
    setStoryViewerOrigin(rect ? { x: rect.left + rect.width / 2 - window.innerWidth / 2, y: rect.top + rect.height / 2 - window.innerHeight / 2, scale: Math.max(0.04, rect.width / window.innerWidth) } : null);
    storyImageProgressStoryIdRef.current = null;
    storyImageProgressElapsedRef.current = 0;
    storyViewerProgressRef.current = 0;
    setStoryMediaReady(false);
    setStoryViewer({ groupIndex, storyIndex, startGroupIndex: groupIndex });
  }, []);

  const openStoryViewerByAuthorId = useCallback(
    (authorId: string, source?: HTMLElement | null) => {
      const match = storyGroupByAuthorId.get(authorId);
      if (!match) return;
      openStoryViewer(match.index, 0, source);
    },
    [openStoryViewer, storyGroupByAuthorId],
  );

  const deleteActiveStory = useCallback(() => {
    return deleteActiveStoryAction({ selfId, activeStory, publishedStoryFeed, setStoryViewerMoreOpen, setStoryFeed, storyViewer, setStoryViewer, storyFeed, setErrorText, t });
  }, [selfId, activeStory, setStoryViewerMoreOpen, publishedStoryFeed, storyFeed, storyViewer?.groupIndex, t]);

  const stepStoryViewer = useCallback(
    (direction: 1 | -1) => {
      if (!storyViewer) return;
      const next = stepStoryPosition(storyFeed, storyViewer, direction);
      if (next === storyViewer) return;
      setStoryMediaReady(false);
      setStoryViewer(next);
    },
    [storyFeed, storyViewer],
  );

  const openStoryAuthorDirect = useCallback(
    async (prefill = "") => {
      return openStoryAuthorDirectAction({ activeStoryGroup, selfId, activeStory, t, setReplyToMessageId, setMessageText, setStoryReplyTarget, activeChat, selectedLink, closeStoryViewer, setSelectedLink, openConversationRef, messageInputRef }, prefill);
    },
    [
      activeChat?.chatType,
      activeChat?.peerId,
      activeStory?.caption,
      activeStory?.id,
      activeStory?.mediaType,
      activeStoryGroup?.author.displayName,
      activeStoryGroup?.author.id,
      activeStoryGroup?.author.link,
      closeStoryViewer,
      router,
      selectedLink,
      selfId, t],
  );

  const toggleActiveStoryLike = useCallback(async () => {
    return toggleActiveStoryLikeAction({ activeStory, storyLikePendingId, setStoryLikePendingId, setStoryFeed, storyViewer, setErrorText, t });
  }, [activeStory, storyLikePendingId, storyViewer?.groupIndex, storyViewer?.storyIndex, t]);

  const loadActiveStoryViewers = useCallback(
    async (full = false) => {
      return loadActiveStoryViewersAction({ activeStory, setStoryViewerStatsFullLoading, setStoryViewerStatsLoading, setStoryViewerStats, setErrorText, t }, full);
    },
    [activeStory?.id, activeStory?.isMine, activeStory?.pendingUpload, t],
  );

  const holdStoryViewer = useCallback(() => {
    setStoryViewerPaused(true);
    const video = storyViewerVideoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
  }, []);

  const releaseStoryViewer = useCallback(() => {
    setStoryViewerPaused(false);
    const video = storyViewerVideoRef.current;
    if (video && activeStory?.mediaType === "video") {
      void video.play().catch(() => undefined);
    }
  }, [activeStory?.mediaType]);

  useEffect(() => {
    if (!activeStory?.id || !storyViewer || activeStory.isMine) return;
    if (viewedStoryIdsRef.current.has(activeStory.id)) return;
    viewedStoryIdsRef.current.add(activeStory.id);
    void apiRequest(`/api/stories/${encodeURIComponent(activeStory.id)}/view`, {
      method: "POST",
    }).catch(() => undefined);
    setStoryFeed((prev) =>
      prev.map((group, groupIndex) =>
        groupIndex !== storyViewer.groupIndex
          ? group
          : {
            ...group,
            hasUnviewed: group.stories.some((story, storyIndex) =>
              storyIndex === storyViewer.storyIndex ? false : !story.viewed,
            ),
            stories: group.stories.map((story, storyIndex) =>
              storyIndex === storyViewer.storyIndex ? { ...story, viewed: true } : story,
            ),
          },
      ),
    );
  }, [activeStory?.id, activeStory?.isMine, storyViewer?.groupIndex, storyViewer?.storyIndex]);

  useEffect(() => {
    return runStoryPlayback({ storyProgressRafRef, activeStory, storyViewer, storyAdvanceTimerRef, storyViewerPaused, storyViewerInteractionLocked, storyImageProgressStoryIdRef, storyImageProgressElapsedRef, storyMediaReady, storyViewerProgressRef, stepStoryViewer });
  }, [activeStory, storyViewer, storyViewerPaused, storyViewerInteractionLocked, storyMediaReady, stepStoryViewer]);

  useEffect(() => {
    if (!activeStory || activeStory.mediaType !== "image") {
      storyImageProgressStoryIdRef.current = null;
      storyImageProgressElapsedRef.current = 0;
      storyViewerProgressRef.current = 0;
      return;
    }
    storyImageProgressStoryIdRef.current = activeStory.id;
    storyImageProgressElapsedRef.current = 0;
    storyViewerProgressRef.current = 0;

  }, [activeStory?.id, activeStory?.mediaType]);

  useEffect(() => {
    const video = storyViewerVideoRef.current;
    if (!video || activeStory?.mediaType !== "video") return;
    if (storyViewerPaused || storyViewerInteractionLocked) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [activeStory?.id, activeStory?.mediaType, storyViewerPaused, storyViewerInteractionLocked]);

  useEffect(() => {
    return bindStoryVideoPlayback({ activeStory, storyViewerVideoRef, storyViewerProgressRef });
  }, [activeStory?.id, activeStory?.mediaType]);

  useEffect(() => {
    setStoryViewerMoreOpen(false);
    setStoryViewerStatsOpen(false);
    setStoryViewerStats(
      activeStory?.isMine
        ? {
          storyId: activeStory.id,
          viewsCount: activeStory.viewsCount,
          viewers: activeStory.viewersPreview,
        }
        : null,
    );
    setStoryViewerStatsLoading(false);
    setStoryViewerStatsFullLoading(false);
  }, [activeStory]);

  useEffect(() => {
    return () => {
      if (storyDraft?.previewUrl) {
        URL.revokeObjectURL(storyDraft.previewUrl);
      }
    };
  }, [storyDraft?.previewUrl]);

  const closeStoryDraft = useCallback(() => {
    setStoryDraft(null);
  }, []);

  return {
    markStoryMediaReady,
    activeStoryGroup,
    activeStory,
    selfStoryGroup,
    selfGroupIndex,
    storyGroupByAuthorId,
    compactStoryGroups,
    mobileStoryRailGroups,
    activeChatStoryEntry,
    closeStoryViewer,
    openStoryViewer,
    openStoryViewerByAuthorId,
    deleteActiveStory,
    stepStoryViewer,
    openStoryAuthorDirect,
    toggleActiveStoryLike,
    loadActiveStoryViewers,
    holdStoryViewer,
    releaseStoryViewer,
    closeStoryDraft
  };
}
