"use client";

import { useRef, useState } from "react";
import { type EmojiComposerHandle } from "@/components/EmojiComposer";
import { type StoryFeedItem, type StoryViewerStats, type StoryReplyTarget, type StoryFeedGroup, type StoryDraft } from "../../types";

export function useStoryDraftState() {
  const [publishedStoryFeed, setStoryFeed] = useState<StoryFeedGroup[]>([]);
  const [pendingStory, setPendingStory] = useState<{ author: StoryFeedGroup["author"]; story: StoryFeedItem } | null>(null);
  const pendingStoryUploadRef = useRef<string | null>(null);
  const visibleStoryIdRef = useRef<string | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storyViewer, setStoryViewer] = useState<{ groupIndex: number; storyIndex: number; startGroupIndex?: number } | null>(null);
  const [storyViewerOrigin, setStoryViewerOrigin] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [storyViewerPaused, setStoryViewerPaused] = useState(false);
  const [storyMediaReady, setStoryMediaReady] = useState(false);
  const [storyViewerStatsOpen, setStoryViewerStatsOpen] = useState(false);
  const [storyViewerMoreOpen, setStoryViewerMoreOpen] = useState(false);
  const [storyViewerStats, setStoryViewerStats] = useState<StoryViewerStats | null>(null);
  const [, setStoryViewerStatsLoading] = useState(false);
  const [storyViewerStatsFullLoading, setStoryViewerStatsFullLoading] = useState(false);
  const [storyLikePendingId, setStoryLikePendingId] = useState<string | null>(null);
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyCameraOpen, setStoryCameraOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(null);
  const [storyDraftKeyboardInset, setStoryDraftKeyboardInset] = useState(0);
  const [storyReplyTarget, setStoryReplyTarget] = useState<StoryReplyTarget | null>(null);
  const [animateSelfStoryRing, setAnimateSelfStoryRing] = useState(false);
  const preloadedStoryUrlsRef = useRef<Set<string>>(new Set());
  const viewedStoryIdsRef = useRef<Set<string>>(new Set());
  const storyFeedLoadPromiseRef = useRef<Promise<void> | null>(null);
  const storyFeedLoadIsForceRef = useRef(false);
  const skipNextInitialChatReloadRef = useRef(false);
  const skipNextInitialStoriesReloadRef = useRef(false);
  return {
    publishedStoryFeed,
    setStoryFeed,
    pendingStory,
    setPendingStory,
    pendingStoryUploadRef,
    visibleStoryIdRef,
    storiesLoading,
    setStoriesLoading,
    storyViewer,
    setStoryViewer,
    storyViewerOrigin,
    setStoryViewerOrigin,
    storyViewerPaused,
    setStoryViewerPaused,
    storyMediaReady,
    setStoryMediaReady,
    storyViewerStatsOpen,
    setStoryViewerStatsOpen,
    storyViewerMoreOpen,
    setStoryViewerMoreOpen,
    storyViewerStats,
    setStoryViewerStats,
    setStoryViewerStatsLoading,
    storyViewerStatsFullLoading,
    setStoryViewerStatsFullLoading,
    storyLikePendingId,
    setStoryLikePendingId,
    storyUploading,
    setStoryUploading,
    storyCameraOpen,
    setStoryCameraOpen,
    storyDraft,
    setStoryDraft,
    storyDraftKeyboardInset,
    setStoryDraftKeyboardInset,
    storyReplyTarget,
    setStoryReplyTarget,
    animateSelfStoryRing,
    setAnimateSelfStoryRing,
    preloadedStoryUrlsRef,
    viewedStoryIdsRef,
    storyFeedLoadPromiseRef,
    storyFeedLoadIsForceRef,
    skipNextInitialChatReloadRef,
    skipNextInitialStoriesReloadRef
  };
}

export function useStoryAndViewportState() {
  const [chatListViewportHeight, setChatListViewportHeight] = useState(0);
  const [messagesScrollTop, setMessagesScrollTop] = useState(0);
  const lastCommittedMessagesScrollTopRef = useRef(0);
  const [messagesViewportHeight, setMessagesViewportHeight] = useState(0);
  const [messageMeasureVersion, setMessageMeasureVersion] = useState(0);
  const [storiesHidden, setStoriesHidden] = useState(true);
  const storiesHiddenRef = useRef(true);
  const lastChatListScrollIntentRef = useRef<{ dir: -1 | 1; at: number } | null>(null);
  const [hasMoreMessagesBefore, setHasMoreMessagesBefore] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const messageInputRef = useRef<EmojiComposerHandle | null>(null);
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const storyAdvanceTimerRef = useRef<number | null>(null);
  const storyViewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const storyProgressRafRef = useRef<number | null>(null);
  const storyImageProgressStoryIdRef = useRef<string | null>(null);
  const storyImageProgressElapsedRef = useRef(0);
  const storyViewerProgressRef = useRef(0);
  const storyOverlayRenderRafRef = useRef<number | null>(null);
  const storyDraftRef = useRef<StoryDraft | null>(null);
  const storyOverlayLastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
  const storyMediaDragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const storyMediaPointersRef = useRef<Record<number, { x: number; y: number }>>({});
  const storyMediaPinchRef = useRef<{ distance: number; baseScale: number } | null>(null);
  const messageHighlightTimeoutRef = useRef<number | null>(null);
  const messageMeasureFrameRef = useRef<number | null>(null);
  const pendingMeasuredMessageIdsRef = useRef<Set<string>>(new Set());
  return {
    chatListViewportHeight,
    setChatListViewportHeight,
    messagesScrollTop,
    setMessagesScrollTop,
    lastCommittedMessagesScrollTopRef,
    messagesViewportHeight,
    setMessagesViewportHeight,
    messageMeasureVersion,
    setMessageMeasureVersion,
    storiesHidden,
    setStoriesHidden,
    storiesHiddenRef,
    lastChatListScrollIntentRef,
    hasMoreMessagesBefore,
    setHasMoreMessagesBefore,
    loadingOlderMessages,
    setLoadingOlderMessages,
    showScrollToBottomButton,
    setShowScrollToBottomButton,
    messageInputRef,
    storyInputRef,
    storyAdvanceTimerRef,
    storyViewerVideoRef,
    storyProgressRafRef,
    storyImageProgressStoryIdRef,
    storyImageProgressElapsedRef,
    storyViewerProgressRef,
    storyOverlayRenderRafRef,
    storyDraftRef,
    storyOverlayLastDrawPointRef,
    storyMediaDragRef,
    storyMediaPointersRef,
    storyMediaPinchRef,
    messageHighlightTimeoutRef,
    messageMeasureFrameRef,
    pendingMeasuredMessageIdsRef
  };
}
