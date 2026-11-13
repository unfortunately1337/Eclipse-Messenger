"use client";

import {
  useChatSelectionState,
  useConversationState,
  useConversationRequestState,
  useChatPanelsState,
  useChatDirectoryMenuState,
  useChatDirectorySearchState,
  useMessageInteractionState
} from "../state/conversation-state";
import { useStoryDraftState } from "../state/stories-state";
import { useAttachmentDraftState, useWallpaperUploadState, usePollDraftState, useRecorderPresentationState, useComposerInteractionState } from "../state/composer-state";
import { useChatAccountState, useChatIdentityState, useSettingsControlsState, useNotificationAndContactsState, useChatAppearanceState } from "../state/account-state";
import { useProfileNavigationState, useMediaAndChannelState, useUserDetailsState, useContactEditorState } from "../state/profiles-state";
import { useGroupDetailsState, useMemberRoleState, useSecretChatDraftState } from "../state/communities-state";

import { useTranslation } from "@/components/LocaleProvider";

import { panelOverlayMotion } from "@/lib/client/panel-motion";
import { schedulePanelIdle } from "@/lib/client/panel-work";
import { requestNetworkCheck } from "@/lib/client/network-monitor";
import { usePanelDirection } from "@/lib/client/use-panel-direction";

import { useMemberContextMenu } from "../../components/common/MemberActionMenu";

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useReducedMotion } from "framer-motion";
import { isRealMediaAvatar } from "@/components/ui/media";

import { apiRequest } from "@/lib/client/http";

import { showAppToast } from "@/lib/client/app-toast";

import { ECLIPSE_DIALOG_LINK } from "@/lib/eclipse-system";

import { useIsMobile } from "@/hooks/use-mobile";

import { type LiveBackgroundSettings } from "@/lib/client/live-background";

import { prefetchEmojiGif } from "@/lib/client/telegram-emoji-gifs";

import { type ChatSummary, type ProfilePreview, type CreateChatKind, type ChatActionPanelState } from "../../types";
import { SETTINGS_LIVE_PRESETS } from "../../constants";

import { chatListPreviewMetaCache } from "../chat-previews";
import { clearChatMemoryCaches, withOwnStory } from "../chat-cache";
import { getEmojisInfo, getEmojisList, parseMessageContentCached } from "../message-content";

import { handlePollVoteAction } from "../poll-actions";
import { loadConnectedAccountsAction, handleSwitchAccountAction, openMessageHelperAction } from "../secret-chat-actions";
import { observePeerPresence, observeChatAppearance } from "../chat-lifecycle";

import type { ChatElementStateModel } from "./useChatElementState";
import type { MessageHistoryModel } from "./useMessageHistory";

export interface ChatPageStateDeferred {
  readonly elements: {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "contactsForAddCacheRef" | "groupModalCacheRef" | "channelModalCacheRef">;

  };
  readonly history: Pick<MessageHistoryModel, "sharedKeyServerCacheRef">;
}
export interface ChatPageStateModel {
  t: (source: string, values?: import("@/lib/i18n/translate").TranslationValues | undefined) => string;
  reducedPanelMotion: boolean | null;
  detailsPanelMotion: {
    initial: {
      opacity: number;
      y: string | number;
      x?: undefined;

    } | {
      opacity: number;
      x: string | number;
      y?: undefined;

    };
    onAnimationStart: (() => void) | undefined;
    animate: {
      opacity: number;
      transition: {
        duration: number;
        ease: readonly [0.2, 0.72, 0.25, 1];

      };
      y: string | number;
      x?: undefined;

    } | {
      opacity: number;
      transition: {
        duration: number;
        ease: readonly [0.2, 0.72, 0.25, 1];

      };
      x: string | number;
      y?: undefined;

    };
    exit: {
      opacity: number;
      transition: {
        duration: number;
        ease: readonly [0.2, 0.72, 0.25, 1];

      };
      y: string | number;
      x?: undefined;

    } | {
      opacity: number;
      transition: {
        duration: number;
        ease: readonly [0.2, 0.72, 0.25, 1];

      };
      x: string | number;
      y?: undefined;

    };

  };
  isMobile: boolean;
  router: import("@/node_modules/next/dist/shared/lib/app-router-context.shared-runtime").AppRouterInstance;
  pathname: string;
  searchParams: import("@/node_modules/next/dist/client/components/readonly-url-search-params").ReadonlyURLSearchParams;
  requestedChatLink: string | null;
  requestedChatType: "direct" | "group" | "channel" | "saved" | "eclipse" | null;
  requestedCreateKind: import("@/app/app/(chats)/types").CreateChatKind | null;
  requestedSettingsParam: string | null;
  selection: ReturnType<typeof useChatSelectionState>;
  storyDraft: ReturnType<typeof useStoryDraftState>;
  attachmentDraft: ReturnType<typeof useAttachmentDraftState>;
  conversation: ReturnType<typeof useConversationState>;
  wallpaperUpload: ReturnType<typeof useWallpaperUploadState>;
  pollResults: Record<string, {
    totalVotes: number;
    optionCounts: Record<number, number>;
    userVotedOptionIdx: number | null;

  }>;
  setPollResults: React.Dispatch<React.SetStateAction<Record<string, {
    totalVotes: number;
    optionCounts: Record<number, number>;
    userVotedOptionIdx: number | null;

  }>>>;
  fetchPollResults: (messageId: string) => Promise<void>;
  handlePollVote: (messageId: string, optionIdx: number | null) => Promise<void>;
  account: ReturnType<typeof useChatAccountState>;
  storyFeed: import("@/app/app/(chats)/types").StoryFeedGroup[];
  identity: ReturnType<typeof useChatIdentityState>;
  conversationRequest: ReturnType<typeof useConversationRequestState>;
  pollDraft: ReturnType<typeof usePollDraftState>;
  panels: ReturnType<typeof useChatPanelsState>;
  hideChatActionPanel: () => void;
  showChatActionPanel: (panel: Omit<import("@/app/app/(chats)/types").ChatActionPanelState, "id">, ttlMs?: number) => void;
  beginMessageSend: () => void;
  endMessageSend: () => void;
  setErrorText: (message: string | null) => void;
  sharedKeyWarmupAtRef: React.RefObject<Record<string, number>>;
  locallyHiddenMessageIds: Set<string>;
  setLocallyHiddenMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  avatarViewerData: {
    open: boolean;
    mediaUrl?: string | null | undefined;
    title: string;
    subtitle?: string | undefined;
    timestamp?: string | number | Date | null | undefined;
    showUploadTimestamp?: boolean | undefined;
    fallbackText?: string | undefined;

  } | null;
  setAvatarViewerData: React.Dispatch<React.SetStateAction<{
    open: boolean;
    mediaUrl?: string | null | undefined;
    title: string;
    subtitle?: string | undefined;
    timestamp?: string | number | Date | null | undefined;
    showUploadTimestamp?: boolean | undefined;
    fallbackText?: string | undefined;

  } | null>>;
  openAvatarViewer: (params: {
    mediaUrl?: string | null | undefined;
    title: string;
    subtitle?: string | undefined;
    timestamp?: string | number | Date | null | undefined;
    showUploadTimestamp?: boolean | undefined;
    fallbackText?: string | undefined;

  }) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  detailsTargetRef: React.RefObject<{
    kind: "direct" | "group" | "channel";
    link: string;

  } | null>;
  profileNavigation: ReturnType<typeof useProfileNavigationState>;
  groupDetails: ReturnType<typeof useGroupDetailsState>;
  memberContextMenu: ReturnType<typeof useMemberContextMenu>;
  memberRole: ReturnType<typeof useMemberRoleState>;
  mediaAndChannel: ReturnType<typeof useMediaAndChannelState>;
  userDetails: ReturnType<typeof useUserDetailsState>;
  handleProfileScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  profileError: string | null;
  setProfileError: React.Dispatch<React.SetStateAction<string | null>>;
  profileData: import("@/app/app/(chats)/types").ProfilePreview | null;
  setProfileData: React.Dispatch<React.SetStateAction<import("@/app/app/(chats)/types").ProfilePreview | null>>;
  profileDataRef: React.RefObject<import("@/app/app/(chats)/types").ProfilePreview | null>;
  secretChatCheckPendingRef: React.RefObject<boolean>;
  profileIsSaved: boolean;
  profileIsEclipse: boolean;
  profileIsBot: boolean;
  contactEditor: ReturnType<typeof useContactEditorState>;
  contactDraftDisplayName: string;
  chatListMenuOpen: boolean;
  setChatListMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  directoryMenu: ReturnType<typeof useChatDirectoryMenuState>;
  otherAccountsUnreadCount: number;
  handleSwitchAccount: (targetUserId: string) => Promise<void>;
  handleAddAccountClick: () => void;
  chatSearchOpen: boolean;
  setChatSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recentSearches: {
    ownerId: string | null;
    items: import("@/app/app/(chats)/types").ChatSummary[];

  };
  setRecentSearches: React.Dispatch<React.SetStateAction<{
    ownerId: string | null;
    items: import("@/app/app/(chats)/types").ChatSummary[];

  }>>;
  directorySearch: ReturnType<typeof useChatDirectorySearchState>;
  deferredChatSearchQuery: string;
  chatSearchInputRef: React.RefObject<HTMLInputElement | null>;
  settingsPanelOpen: boolean;
  setSettingsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsPanelCovered: boolean;
  setSettingsPanelCovered: React.Dispatch<React.SetStateAction<boolean>>;
  settingsDrawerLoaded: boolean;
  settingsControls: ReturnType<typeof useSettingsControlsState>;
  createChatNavDirection: "forward" | "backward";
  profileNavDirection: "forward" | "backward";
  groupNavDirection: "forward" | "backward";
  channelNavDirection: "forward" | "backward";
  secretChatDraft: ReturnType<typeof useSecretChatDraftState>;
  handleSecretChatPresetSelect: (preset: "1h" | "1d" | "1w" | "1m" | "custom") => void;
  handledCreateParamRef: React.RefObject<import("@/app/app/(chats)/types").CreateChatKind | null>;
  filteredCreateChatContacts: {
    id: string;
    link: string;
    alias: string;
    avatarUrl?: string | null | undefined;
    displayName?: string | undefined;

  }[];
  notificationAndContacts: ReturnType<typeof useNotificationAndContactsState>;
  activeCustomTheme: import("@/lib/client/custom-chat-theme").CustomChatTheme | null | undefined;
  transparentVisual: boolean;
  liveBackgroundLayerSettings: import("@/lib/client/live-background").LiveBackgroundSettings;
  liveBgPresetColors: string | undefined;
  appearance: ReturnType<typeof useChatAppearanceState>;
  messageHelperReadListOpen: boolean;
  setMessageHelperReadListOpen: React.Dispatch<React.SetStateAction<boolean>>;
  messageInteraction: ReturnType<typeof useMessageInteractionState>;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  setPresenceNowTs: React.Dispatch<React.SetStateAction<number>>;
  recorderPresentation: ReturnType<typeof useRecorderPresentationState>;
  composerInteraction: ReturnType<typeof useComposerInteractionState>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatPageState(deferred: ChatPageStateDeferred): ChatPageStateModel {

  const t = useTranslation();

  const reducedPanelMotion = useReducedMotion();

  const detailsPanelMotion = useMemo(() => panelOverlayMotion(reducedPanelMotion, "right"), [reducedPanelMotion]);

  const isMobile = useIsMobile();

  const router = useRouter();

  const pathname = usePathname();

  const searchParams = useSearchParams();

  const requestedChatLink = searchParams.get("chat")?.trim().toLowerCase() ?? null;

  const requestedChatTypeParam = searchParams.get("chatType");

  const requestedChatType =
    requestedChatTypeParam === "direct" ||
      requestedChatTypeParam === "group" ||
      requestedChatTypeParam === "channel" ||
      requestedChatTypeParam === "saved" ||
      requestedChatTypeParam === "eclipse"
      ? requestedChatTypeParam
      : requestedChatLink === ECLIPSE_DIALOG_LINK
        ? "eclipse"
        : requestedChatLink === "saved"
          ? "saved"
          : null;

  const requestedCreateParam = searchParams.get("create");

  const requestedCreateKind: CreateChatKind | null =
    requestedCreateParam === "group" || requestedCreateParam === "channel" ? requestedCreateParam : null;

  const requestedSettingsParam = searchParams.get("settings")?.trim().toLowerCase() ?? null;

  const selectionStateModel = useChatSelectionState(requestedChatLink);
  const {
    selectedLink, setSelectedLink, selectedLinkRef, selectedSearchTargetRef, selectedLinkChangedAtRef,
    messageText, setMessageText
  } = selectionStateModel;

  const storyDraftStateModel = useStoryDraftState();
  const {
    publishedStoryFeed, setStoryFeed, pendingStory, setPendingStory, pendingStoryUploadRef,
    visibleStoryIdRef, storiesLoading, setStoriesLoading, storyViewer, setStoryViewer,
    storyViewerOrigin, setStoryViewerOrigin, storyViewerPaused, setStoryViewerPaused, storyMediaReady,
    setStoryMediaReady, storyViewerStatsOpen, setStoryViewerStatsOpen, storyViewerMoreOpen, setStoryViewerMoreOpen,
    storyViewerStats, setStoryViewerStats, setStoryViewerStatsLoading, storyViewerStatsFullLoading, setStoryViewerStatsFullLoading,
    storyLikePendingId, setStoryLikePendingId, storyUploading, setStoryUploading, storyCameraOpen,
    setStoryCameraOpen, storyDraft, setStoryDraft, storyDraftKeyboardInset, setStoryDraftKeyboardInset,
    storyReplyTarget, setStoryReplyTarget, animateSelfStoryRing, setAnimateSelfStoryRing, preloadedStoryUrlsRef,
    viewedStoryIdsRef, storyFeedLoadPromiseRef, storyFeedLoadIsForceRef, skipNextInitialChatReloadRef, skipNextInitialStoriesReloadRef
  } = storyDraftStateModel;

  const attachmentDraftStateModel = useAttachmentDraftState();
  const {
    pendingMediaBatch, setPendingMediaBatch, pendingImage, setPendingImage, pendingVideo,
    setPendingVideo, pendingAudio, setPendingAudio, pendingFile, setPendingFile,
    stickerPickerOpen, setStickerPickerOpen, hasRenderedPicker, setHasRenderedPicker
  } = attachmentDraftStateModel;

  useEffect(() => {
    if (stickerPickerOpen) {
      setHasRenderedPicker(true);
    }
  }, [stickerPickerOpen]);

  const conversationStateModel = useConversationState();
  const {
    composerPickerTab, setComposerPickerTab, stickerPickerPackId, setStickerPickerPackId, attachmentMenuOpen,
    setAttachmentMenuOpen, chats, setChats, chatsRef, activeConversation,
    setActiveConversation, mediaReadyVersion, setMediaReadyVersion, startingBot, setStartingBot,
    botStartRequestRef, activeConversationRef, messages, setMessages
  } = conversationStateModel;

  useEffect(() => {
    let refreshFrame: number | undefined;
    const refresh = () => {
      if (refreshFrame !== undefined) return;
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = undefined;
        chatListPreviewMetaCache.clear();
        setMediaReadyVersion(version => version + 1);
        setMessages(previous => [...previous]);
      });
    };
    const purge = () => { clearChatMemoryCaches(); setMessages([]); };
    window.addEventListener("eclipse:caches-cleared", purge);
    window.addEventListener("eclipse:media-ready", refresh);
    return () => {
      if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame);
      window.removeEventListener("eclipse:caches-cleared", purge);
      window.removeEventListener("eclipse:media-ready", refresh);
    };
  }, []);

  const wallpaperUploadStateModel = useWallpaperUploadState();
  const {
    dragActive, setDragActive, wallpaperFileInputRef, wallpaperTargetRef, uploadingWallpaper,
    setUploadingWallpaper, applyingWallpaper, setApplyingWallpaper, pickedFilesProcessingRef
  } = wallpaperUploadStateModel;

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const recent = messages.slice(-30);
    for (const msg of recent) {
      if (typeof msg.text === "string" && msg.text) {
        const info = getEmojisInfo(msg.text);
        if (info.isOnly && info.count === 1) {
          const list = getEmojisList(msg.text);
          for (const emoji of list) {
            prefetchEmojiGif(emoji);
          }
        }
      }
    }
  }, [messages]);

  const [pollResults, setPollResults] = useState<Record<string, {
    totalVotes: number;
    optionCounts: Record<number, number>;
    userVotedOptionIdx: number | null

  }>>({});

  const requestedPollsRef = useRef<Set<string>>(new Set());
  const pollVoteQueueRef = useRef(new Map<string, Promise<void>>());
  const pollMutationVersionsRef = useRef(new Map<string, number>());

  const fetchPollResults = useCallback(async (messageId: string) => {
    if (requestedPollsRef.current.has(messageId)) return;
    requestedPollsRef.current.add(messageId);
    const version = pollMutationVersionsRef.current.get(messageId);
    try {
      const res = await apiRequest<{
        totalVotes: number;
        optionCounts: Record<number, number>;
        userVotedOptionIdx: number | null

      }>(
        `/api/polls?messageId=${encodeURIComponent(messageId)}`,
        { method: "GET" }
      );
      if (pollMutationVersionsRef.current.get(messageId) !== version) return;
      setPollResults((prev) => ({
        ...prev,
        [messageId]: res,
      }));
    } catch (err) {
      requestedPollsRef.current.delete(messageId);
      console.error("Failed to fetch poll results:", err);
    }
  }, []);

  const handlePollVote = useCallback(async (messageId: string, optionIdx: number | null) => {
    const message = messages.find(item => item.id === messageId);
    if (!message || message.pending) return;
    const poll = parseMessageContentCached(message.text);
    const current = pollResults[messageId];
    if (poll.kind !== "poll" || (poll.expiresAt && Date.parse(poll.expiresAt) <= Date.now())) return;
    if (optionIdx === null ? poll.quizMode || current?.userVotedOptionIdx == null : current?.userVotedOptionIdx != null || optionIdx < 0 || optionIdx >= poll.options.length) return;
    pollMutationVersionsRef.current.set(messageId, (pollMutationVersionsRef.current.get(messageId) ?? 0) + 1);
    await handlePollVoteAction({ setPollResults, current, mutationQueue: pollVoteQueueRef.current }, messageId, optionIdx);
  }, [messages, pollResults]);

  const accountStateModel = useChatAccountState();
  const {
    activeUnreadCount, setActiveUnreadCount, animatedMessageIdsRef, suppressMessageEntranceRef, selfId,
    setSelfId, selfProfile, setSelfProfile, storyAccountRef
  } = accountStateModel;

  useLayoutEffect(() => { storyAccountRef.current = selfId; }, [selfId]);

  const storyFeed = useMemo(() => pendingStory && pendingStory.author.id === selfId
    ? withOwnStory(publishedStoryFeed, pendingStory.author, pendingStory.story)
    : publishedStoryFeed, [pendingStory, publishedStoryFeed, selfId]);

  const identityStateModel = useChatIdentityState();
  const {
    selfPublicKey, setSelfPublicKey, privateKey, setPrivateKey, e2eBootstrapCompleted,
    setE2EBootstrapCompleted, e2eIdentityReady, setE2EIdentityReady, privateKeyRef, cryptoDiagnosticRef
  } = identityStateModel;

  const conversationRequestStateModel = useConversationRequestState();
  const {
    syncing, setSyncing, loadingConversation, setLoadingConversation, decryptingConversation,
    setDecryptingConversation, setLoadingChats, chatListResolvedOnce, setChatListResolvedOnce, sending,
    setSending, activeSendCountRef, sendingMessageInFlightRef, sendingMedia, setSendingMedia
  } = conversationRequestStateModel;

  const pollDraftStateModel = usePollDraftState();
  const {
    pollDialogOpen, setPollDialogOpen, pollQuestion, setPollQuestion, pollOptions,
    setPollOptions, pollQuizMode, setPollQuizMode, pollCorrectOptionIndex, setPollCorrectOptionIndex,
    pollExpiresInHours, setPollExpiresInHours
  } = pollDraftStateModel;

  const panelsStateModel = useChatPanelsState();
  const {
    isDesktop, setIsDesktop, desktopDetailsPanelOpen, setDesktopDetailsPanelOpen, inspectedDetailsEntity,
    setInspectedDetailsEntity, chatActionPanel, setChatActionPanel, setErrorTextState, chatActionPanelTimeoutRef,
    pendingDeleteRef, pendingSelectionDeleteRef
  } = panelsStateModel;

  const hideChatActionPanel = useCallback(() => {
    if (chatActionPanelTimeoutRef.current) {
      clearTimeout(chatActionPanelTimeoutRef.current);
      chatActionPanelTimeoutRef.current = null;
    }
    setChatActionPanel(null);
  }, []);

  const showChatActionPanel = useCallback((
    panel: Omit<ChatActionPanelState, "id">,
    ttlMs = 2400,
  ) => {
    if (chatActionPanelTimeoutRef.current) {
      clearTimeout(chatActionPanelTimeoutRef.current);
      chatActionPanelTimeoutRef.current = null;
    }
    const id = Date.now();
    setChatActionPanel({ id, ...panel });
    if (ttlMs > 0) {
      chatActionPanelTimeoutRef.current = setTimeout(() => {
        setChatActionPanel((current) => (current?.id === id ? null : current));
        chatActionPanelTimeoutRef.current = null;
      }, ttlMs);
    }
  }, []);

  const beginMessageSend = useCallback(() => {
    activeSendCountRef.current += 1;
    setSending(true);
  }, []);

  const endMessageSend = useCallback(() => {
    activeSendCountRef.current = Math.max(0, activeSendCountRef.current - 1);
    if (activeSendCountRef.current === 0) {
      setSending(false);
    }
  }, []);

  const setErrorText = useCallback((message: string | null) => {
    setErrorTextState(message);
    if (!message) return;
    if (message.includes("старая версия Eclipse") || message.includes("перезайти в мессенджер")) {
      showAppToast({ type: "info", title: message, icon: "info", durationMs: 4000 });
      return;
    }
    if (
      message.includes("Нестабильное соединение") ||
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("Failed to execute 'fetch'")
    ) {
      requestNetworkCheck();
      return;
    }
    showChatActionPanel({ icon: "error", message }, 3200);
  }, [showChatActionPanel, t]);

  const sharedKeyWarmupAtRef = useRef<Record<string, number>>({});

  const [locallyHiddenMessageIds, setLocallyHiddenMessageIds] = useState<Set<string>>(new Set());

  const [avatarViewerData, setAvatarViewerData] = useState<{

    open: boolean;

    mediaUrl?: string | null;

    title: string;

    subtitle?: string;

    timestamp?: string | number | Date | null;

    showUploadTimestamp?: boolean;

    fallbackText?: string;

  } | null>(null);

  const openAvatarViewer = useCallback((params: {

    mediaUrl?: string | null;

    title: string;

    subtitle?: string;

    timestamp?: string | number | Date | null;

    showUploadTimestamp?: boolean;

    fallbackText?: string;

  }) => {
    if (!isRealMediaAvatar(params.mediaUrl)) return;
    setAvatarViewerData({
      open: true,
      ...params,
    });
  }, []);

  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const detailsTargetRef = useRef<{
    kind: "direct" | "group" | "channel";
    link: string

  } | null>(null);

  useEffect(() => { detailsTargetRef.current = null; }, [selfId]);

  const profileNavigationStateModel = useProfileNavigationState();
  const {
    profileOpenedExternally, setProfileOpenedExternally, profileMoreOpen, setProfileMoreOpen, hoverReactionMessageId,
    setHoverReactionMessageId, hoverReactionExpandedMessageId, setHoverReactionExpandedMessageId, messageHelperAllReactionsOpen, setMessageHelperAllReactionsOpen,
    hoverReactionTimerRef, hoverReactionLeaveTimerRef, profileSubView, setProfileSubView, qrModalProfile,
    setQrModalProfile, linkEditorTarget, setLinkEditorTarget, linkEditorValue, setLinkEditorValue,
    linkEditorStatus, setLinkEditorStatus, linkEditorSaving, setLinkEditorSaving
  } = profileNavigationStateModel;

  useEffect(() => {
    if (!linkEditorTarget) return;
    const normalized = linkEditorValue.trim().toLowerCase().replace(/^@+/u, "");
    if (!normalized || normalized.length < 4 || !/^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(normalized)) {
      setLinkEditorStatus("invalid");
      return;
    }
    if (normalized === linkEditorTarget.currentLink) {
      setLinkEditorStatus("available");
      return;
    }
    setLinkEditorStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ available: boolean }>(`/api/groups/check-link?link=${encodeURIComponent(normalized)}`, { method: "GET" });
        setLinkEditorStatus(res.available ? "available" : "taken");
      } catch {
        setLinkEditorStatus("invalid");
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [linkEditorValue, linkEditorTarget]);

  const groupDetailsStateModel = useGroupDetailsState();
  const {
    groupModalOpen, setGroupModalOpen, groupModalLoading, setGroupModalLoading, groupModalError,
    setGroupModalError, groupModalData, setGroupModalData, groupNameDraft, setGroupNameDraft,
    groupDescriptionDraft, setGroupDescriptionDraft, groupNameEditing, setGroupNameEditing, groupAvatarDraft,
    setGroupAvatarDraft, groupSubView, setGroupSubView, groupMembersReturnViewRef, groupIsPublicDraft,
    setGroupIsPublicDraft, reactionSettingsDraft, setReactionSettingsDraft, groupLinkDraft, setGroupLinkDraft,
    inviteModalOpen, setInviteModalOpen, inviteModalKind, setInviteModalKind, inviteModalLink,
    setInviteModalLink, groupSaving, setGroupSaving, leavingGroup, setLeavingGroup,
    deletingGroup, setDeletingGroup, joiningGroup, setJoiningGroup, removingMemberId,
    setRemovingMemberId, groupMemberRemovalTarget, setGroupMemberRemovalTarget, removingSubscriberId, setRemovingSubscriberId,
    channelSubscriberRemovalTarget, setChannelSubscriberRemovalTarget
  } = groupDetailsStateModel;

  const memberContextMenu = useMemberContextMenu(isDesktop);

  const memberRoleStateModel = useMemberRoleState();
  const {
    roleEditorKind, setRoleEditorKind, roleModalMember, setRoleModalMember, roleNameDraft,
    setRoleNameDraft, permChangeAvatar, setPermChangeAvatar, permChangeName, setPermChangeName,
    permChangeReactions, setPermChangeReactions, permPinMessages, permStartVideoChat, setPermPinMessages, setPermStartVideoChat, permDeleteForeign,
    setPermDeleteForeign, permAddMembers, setPermAddMembers, permPostMessages, setPermPostMessages,
    permEditForeignMessages, setPermEditForeignMessages, permDeleteForeignMessages, setPermDeleteForeignMessages, permGenerateInviteLink,
    setPermGenerateInviteLink, permManageAdmins, setPermManageAdmins, roleEditorInitial, setRoleEditorInitial
  } = memberRoleStateModel;

  const roleEditorDirty = Boolean(
    roleEditorInitial &&
    (roleNameDraft.trim() !== roleEditorInitial.roleName ||
      permChangeAvatar !== roleEditorInitial.canChangeAvatar ||
      permChangeName !== roleEditorInitial.canChangeName ||
      permChangeReactions !== roleEditorInitial.canChangeReactions ||
      permPinMessages !== roleEditorInitial.canPinMessages ||
      permStartVideoChat !== roleEditorInitial.canStartVideoChat ||
      permDeleteForeign !== roleEditorInitial.canDeleteForeignMessages ||
      permAddMembers !== roleEditorInitial.canAddMembers ||
      permPostMessages !== roleEditorInitial.canPostMessages ||
      permGenerateInviteLink !== roleEditorInitial.canGenerateInviteLink ||
      permManageAdmins !== roleEditorInitial.canManageAdmins ||
      permEditForeignMessages !== roleEditorInitial.canEditForeignMessages ||
      permDeleteForeignMessages !== roleEditorInitial.canDeleteForeignMessages_channel),
  );

  const mediaAndChannelStateModel = useMediaAndChannelState(groupSubView);
  const {
    savingRole, setSavingRole, groupDangerAction, setGroupDangerAction, channelModalOpen,
    setChannelModalOpen, channelModalLoading, setChannelModalLoading, channelModalError, setChannelModalError,
    channelModalData, setChannelModalData, channelNameDraft, setChannelNameDraft, channelDescriptionDraft,
    setChannelDescriptionDraft, channelNameEditing, setChannelNameEditing, channelAvatarDraft, setChannelAvatarDraft,
    channelSubView, setChannelSubView, channelMembersReturnViewRef, memberSearchQuery, setMemberSearchQuery,
    channelIsPublicDraft, setChannelIsPublicDraft, channelLinkDraft, setChannelLinkDraft, channelSaving,
    setChannelSaving, channelLeaving, setChannelLeaving, channelDeleting, setChannelDeleting,
    channelDangerAction, setChannelDangerAction, videoViewer, setVideoViewer, videoViewerPlaying,
    setVideoViewerPlaying, videoViewerProgress, setVideoViewerProgress, videoViewerDuration, setVideoViewerDuration,
    videoViewerCurrentTime, setVideoViewerCurrentTime, videoViewerMuted, setVideoViewerMuted, videoViewerFailed,
    setVideoViewerFailed, videoViewerMenuOpen, setVideoViewerMenuOpen, imageViewer, setImageViewer,
    imageViewerIndex, setImageViewerIndex, imageViewerDirection, setImageViewerDirection, imageViewerPanelVisible,
    setImageViewerPanelVisible, imageViewerMenuOpen, setImageViewerMenuOpen, imageViewerTouchRef, isCoarsePointer,
    setIsCoarsePointer, addMembersModalOpen, setAddMembersModalOpen, addMembersContactQuery, setAddMembersContactQuery,
    addMembersTargetKind, setAddMembersTargetKind, groupAddMembersReturnViewRef, channelAddMembersReturnViewRef, contactsForAdd,
    setContactsForAdd, selectedContactIds, setSelectedContactIds, addMembersContactsLoading, setAddMembersContactsLoading,
    addingMembers, setAddingMembers
  } = mediaAndChannelStateModel;

  useEffect(() => {
    setMemberSearchQuery("");
  }, [channelSubView, groupSubView, groupModalOpen, channelModalOpen, addMembersModalOpen]);

  const userDetailsStateModel = useUserDetailsState();
  const {
    profileLoading, setProfileLoading, profileActiveTab, setProfileActiveTab, profilePlayingAudioUrl,
    setProfilePlayingAudioUrl, profileScrollTop, setProfileScrollTop
  } = userDetailsStateModel;

  const handleProfileScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    // The header only has two states; pixel-by-pixel updates redraw the entire chat.
    setProfileScrollTop(event.currentTarget.scrollTop > 140 ? 141 : 0);
  }, []);

  const [profileError, setProfileError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<ProfilePreview | null>(null);

  useLayoutEffect(() => {
    setProfileScrollTop(0);
  }, [profileData?.id, inspectedDetailsEntity?.link, selectedLink]);

  const profileDataRef = useRef(profileData);

  profileDataRef.current = profileData;

  const secretChatCheckPendingRef = useRef(false);

  const profileIsSaved = profileData?.link === "saved";

  const profileIsEclipse = profileData?.link === ECLIPSE_DIALOG_LINK;

  const profileIsBot = Boolean(profileIsEclipse || profileData?.isBot || (profileData?.id && activeConversation?.peer?.id === profileData.id && activeConversation.peer.isBot));

  const contactEditorStateModel = useContactEditorState();
  const {
    collectibleModalUsername, setCollectibleModalUsername, bumpProfileBatchVersion, contactFirstName, setContactFirstName,
    contactLastName, setContactLastName, contactExists, setContactExists, contactSaving,
    setContactSaving, contactMessage, setContactMessage, contactEditorOpen, setContactEditorOpen,
    contactEditorTarget, setContactEditorTarget, contactEditorInitial, setContactEditorInitial
  } = contactEditorStateModel;

  const contactDraftDisplayName = [contactFirstName.trim(), contactLastName.trim()].filter(Boolean).join(" ").trim();

  const contactEditorDirty = Boolean(
    contactEditorInitial &&
    (contactFirstName.trim() !== contactEditorInitial.firstName ||
      contactLastName.trim() !== contactEditorInitial.lastName),
  );

  const [chatListMenuOpen, setChatListMenuOpen] = useState(false);

  useEffect(() => {
    if (!chatListMenuOpen) return;
    // Start fetching the settings module while the user chooses a menu item.
    void import("../../components/common/SettingsDrawer").catch(() => { });
  }, [chatListMenuOpen]);

  const directoryMenuStateModel = useChatDirectoryMenuState();
  const {
    chatListMenuPosition, setChatListMenuPosition, chatListMenuOrigin, setChatListMenuOrigin, menuShowMore,
    setMenuShowMore, accountsRequestPending, connectedAccounts, setConnectedAccounts, switchingAccountId,
    setSwitchingAccountId, isAccountsExpanded, setIsAccountsExpanded
  } = directoryMenuStateModel;

  const hasOtherAccounts = connectedAccounts.some(account => !account.isActive);

  const otherAccountsUnreadCount = connectedAccounts.reduce((total, account) => {
    const count = account.unreadCount;
    return account.isActive || account.id === selfId || !Number.isFinite(count) || !count || count < 1
      ? total : total + Math.floor(count);
  }, 0);

  const loadConnectedAccounts = useCallback(async () => {
    return loadConnectedAccountsAction({ accountsRequestPending, setConnectedAccounts });
  }, []);

  useEffect(() => {
    void loadConnectedAccounts();
  }, [loadConnectedAccounts]);

  useEffect(() => {
    if (!chatListMenuOpen && !hasOtherAccounts) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadConnectedAccounts();
    };
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [chatListMenuOpen, hasOtherAccounts, loadConnectedAccounts]);

  const handleSwitchAccount = async (targetUserId: string) => {
    return handleSwitchAccountAction({ switchingAccountId, setSwitchingAccountId, connectedAccounts, contactsForAddCacheRef: deferred.elements.conversationElement.contactsForAddCacheRef, groupModalCacheRef: deferred.elements.conversationElement.groupModalCacheRef, channelModalCacheRef: deferred.elements.conversationElement.channelModalCacheRef, sharedKeyServerCacheRef: deferred.history.sharedKeyServerCacheRef, setChatSearchOpen, setChatSearchQuery, setChatSearchUsers, setChatSearchGroups, setChatSearchChannels, setChatSearchSaved, setChatSearchEclipse, setContactsForAdd, t }, targetUserId);
  };

  const handleAddAccountClick = () => {
    setChatListMenuOpen(false);
    document.cookie = "eclipse.add_account=1; path=/; max-age=900; SameSite=Lax";
    window.location.assign("/login?addAccount=1");
  };

  const [chatSearchOpen, setChatSearchOpen] = useState(false);

  const [recentSearches, setRecentSearches] = useState<{
    ownerId: string | null;
    items: ChatSummary[]

  }>({ ownerId: null, items: [] });

  useEffect(() => {
    let items: ChatSummary[] = [];
    if (selfId) {
      try {
        const stored = JSON.parse(window.localStorage.getItem(`eclipse:search:recent:v1:${selfId}`) ?? "[]");
        if (Array.isArray(stored)) items = stored.filter(item => item && typeof item.link === "string" && typeof item.displayName === "string" && typeof item.peerId === "string" && ["direct", "group", "channel", "saved", "eclipse"].includes(item.chatType)).slice(0, 50);
      } catch { /* Recent search is optional when browser storage is unavailable. */ }
    }
    setRecentSearches({ ownerId: selfId, items });
  }, [selfId]);

  useEffect(() => {
    if (!selfId || recentSearches.ownerId !== selfId) return;
    try { window.localStorage.setItem(`eclipse:search:recent:v1:${selfId}`, JSON.stringify(recentSearches.items)); } catch { /* Storage may be full or disabled. */ }
  }, [selfId, recentSearches]);

  const directorySearchStateModel = useChatDirectorySearchState();
  const {
    chatSearchQuery, setChatSearchQuery, chatSearchScope, setChatSearchScope, chatSearchLoading,
    setChatSearchLoading, chatSearchError, setChatSearchError, chatSearchUsers, setChatSearchUsers,
    chatSearchGroups, setChatSearchGroups, chatSearchChannels, setChatSearchChannels, chatSearchSaved,
    setChatSearchSaved, chatSearchEclipse, setChatSearchEclipse
  } = directorySearchStateModel;

  const deferredChatSearchQuery = useDeferredValue(chatSearchQuery);

  const chatSearchInputRef = useRef<HTMLInputElement | null>(null);

  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  const [settingsPanelCovered, setSettingsPanelCovered] = useState(false);

  useEffect(() => { if (!settingsPanelOpen) setSettingsPanelCovered(false); }, [settingsPanelOpen]);

  const [settingsDrawerLoaded, setSettingsDrawerLoaded] = useState(false);

  useEffect(() => { if (settingsPanelOpen) setSettingsDrawerLoaded(true); }, [settingsPanelOpen]);

  useEffect(() => schedulePanelIdle(() => {
    // Warm the split bundle without mounting settings or fetching private settings data.
    void import("../../components/common/SettingsDrawer").catch(() => { });
  }, 1200), []);

  const settingsControlsStateModel = useSettingsControlsState();
  const {
    settingsAvatarInputRef, settingsMusicInputRef, showRotationTimePicker, setShowRotationTimePicker, createChatKind,
    setCreateChatKind, createChatStep, setCreateChatStep, createChatDraft, setCreateChatDraft,
    createChatSelectedIds, setCreateChatSelectedIds, createChatContactQuery, setCreateChatContactQuery, createChatContactsLoading,
    setCreateChatContactsLoading, createChatCreating, setCreateChatCreating
  } = settingsControlsStateModel;

  const createChatDepth = createChatKind === "channel"
    ? createChatStep === "members" ? 2 : createChatStep === "settings" ? 1 : 0
    : createChatStep === "settings" ? 2 : createChatStep === "details" ? 1 : 0;

  const createChatNavDirection = usePanelDirection(createChatDepth, `${createChatKind}:${createChatStep}`);

  const profileNavDirection = usePanelDirection(profileSubView === null ? 0 : 1, profileSubView);

  const groupNavDirection = usePanelDirection(!groupSubView ? 0 : ["add_members", "reactions", "type"].includes(groupSubView) ? 2 : 1, groupSubView);

  const channelNavDirection = usePanelDirection(!channelSubView ? 0 : ["add_subscribers", "reactions", "type"].includes(channelSubView) ? 2 : 1, channelSubView);

  const secretChatDraftStateModel = useSecretChatDraftState();
  const {
    secretChatCreateOpen, setSecretChatCreateOpen, secretChatInfoOpen, setSecretChatInfoOpen, secretChatCreateStep,
    setSecretChatCreateStep, secretChatTitle, setSecretChatTitle, secretChatSearchQuery, setSecretChatSearchQuery,
    secretChatSelectedUserIds, setSecretChatSelectedUserIds, secretChatLifetimeDays, setSecretChatLifetimeDays, secretChatLifetimeHours,
    setSecretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatLifetimeMinutes, secretChatLifetimePreset, setSecretChatLifetimePreset,
    secretChatCodeword, setSecretChatCodeword, secretChatCreating, setSecretChatCreating, secretChatExpiresAt,
    setSecretChatExpiresAt, acceptingSecretChat, setAcceptingSecretChat, globalMusicVisible, setGlobalMusicVisible
  } = secretChatDraftStateModel;

  useEffect(() => {
    const onMusicState = (e: Event) => {
      const custom = e as CustomEvent<{ visible?: boolean }>;
      setGlobalMusicVisible(Boolean(custom.detail?.visible));
    };
    window.addEventListener("eclipse:music-state", onMusicState as EventListener);
    return () => window.removeEventListener("eclipse:music-state", onMusicState as EventListener);
  }, []);

  const handleSecretChatPresetSelect = (preset: '1h' | '1d' | '1w' | '1m' | 'custom') => {
    setSecretChatLifetimePreset(preset);
    if (preset === '1h') {
      setSecretChatLifetimeDays(0);
      setSecretChatLifetimeHours(1);
      setSecretChatLifetimeMinutes(0);
    } else if (preset === '1d') {
      setSecretChatLifetimeDays(1);
      setSecretChatLifetimeHours(0);
      setSecretChatLifetimeMinutes(0);
    } else if (preset === '1w') {
      setSecretChatLifetimeDays(7);
      setSecretChatLifetimeHours(0);
      setSecretChatLifetimeMinutes(0);
    } else if (preset === '1m') {
      setSecretChatLifetimeDays(30);
      setSecretChatLifetimeHours(0);
      setSecretChatLifetimeMinutes(0);
    }
  };

  const handledCreateParamRef = useRef<CreateChatKind | null>(null);

  const filteredAddMembersContacts = useMemo(() => {
    const list = contactsForAdd.filter((contact) =>
      addMembersTargetKind === "group" && groupModalData
        ? !groupModalData.members.some((member) => member.id === contact.id)
        : true
    );
    const query = addMembersContactQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((c) => {
      const name = (c.alias || c.displayName || c.link || "").toLowerCase();
      return name.includes(query);
    });
  }, [contactsForAdd, addMembersTargetKind, groupModalData, addMembersContactQuery]);

  const filteredCreateChatContacts = useMemo(() => {
    const query = createChatContactQuery.trim().toLowerCase().replace(/^@+/, "");
    if (!query) return contactsForAdd;
    return contactsForAdd.filter((contact) => {
      const values = [contact.alias, contact.displayName, contact.link]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      return values.some((value) => value.includes(query));
    });
  }, [contactsForAdd, createChatContactQuery]);

  const selectedCreateChatContacts = useMemo(
    () => contactsForAdd.filter((contact) => createChatSelectedIds.has(contact.id)),
    [contactsForAdd, createChatSelectedIds],
  );

  const notificationAndContactsStateModel = useNotificationAndContactsState();
  const {
    mutedChatLinkSet, setMutedChatLinkSet, pinnedChatLinkSet, setPinnedChatLinkSet, chatListHelper,
    setChatListHelper, directChatDeleteConfirm, setDirectChatDeleteConfirm, liveBackgroundPreset, setLiveBackgroundPreset,
    liveBackgroundOpacity, setLiveBackgroundOpacity, liveBackgroundMotionSpeed, setLiveBackgroundMotionSpeed, messageThemeEnabled,
    setMessageThemeEnabled, customTheme, setCustomTheme, customThemeEnabled, setCustomThemeEnabled
  } = notificationAndContactsStateModel;

  const activeCustomTheme = customThemeEnabled ? customTheme : null;

  const [transparentVisual, setTransparentVisual] = useState(true);

  const liveBackgroundLayerSettings = useMemo<LiveBackgroundSettings>(
    () => ({
      neatPreset: liveBackgroundPreset,
      opacity: liveBackgroundOpacity,
      motionSpeed: liveBackgroundMotionSpeed,
      messageThemeEnabled,
      transparentVisual,
      customTheme,
      customThemeEnabled,
    }),
    [liveBackgroundMotionSpeed, liveBackgroundOpacity, liveBackgroundPreset, messageThemeEnabled, transparentVisual, customTheme, customThemeEnabled],
  );

  const activePresetObj = useMemo(() => SETTINGS_LIVE_PRESETS.find((p) => p.id === liveBackgroundPreset), [liveBackgroundPreset]);

  const liveBgPresetColors = activePresetObj ? activePresetObj.colors : undefined;

  const appearanceStateModel = useChatAppearanceState();
  const {
    chatUiSettings, setChatUiSettings, messageHelperId, setMessageHelperId, desktopMessageHelperRef,
    messageHelperAnchor, setMessageHelperAnchor
  } = appearanceStateModel;

  const openMessageHelper = useCallback((msgId: string, event?: React.MouseEvent | React.TouchEvent | HTMLElement) => {
    return openMessageHelperAction({ messageHelperId, setMessageHelperId, setMessageHelperAllReactionsOpen, setMessageHelperAnchor, setMessageHelperReadListOpen }, msgId, event);
  }, [messageHelperId]);

  const [messageHelperReadListOpen, setMessageHelperReadListOpen] = useState(false);

  useEffect(() => {
    if (!messageHelperId) {
      setMessageHelperAllReactionsOpen(false);
    }
  }, [messageHelperId]);

  const messageInteractionStateModel = useMessageInteractionState();
  const {
    highlightedMessageId, setHighlightedMessageId, messageHelperHorizontalPlacement, setMessageHelperHorizontalPlacement, forwardPickerMode,
    setForwardPickerMode, forwardPickerMessages, setForwardPickerMessages, forwardDraft, setForwardDraft,
    forwardSending, setForwardSending, selectionMode, setSelectionMode, selectedMessageIds,
    setSelectedMessageIds, selectionDeleting, setSelectionDeleting, selectionDeleteDialogOpen, setSelectionDeleteDialogOpen,
    externalLinkPrompt, setExternalLinkPrompt, deletingMessageId, setDeletingMessageId, chatsCursor,
    setChatsCursor, hasMoreChats, setHasMoreChats, loadingMoreChats, setLoadingMoreChats,
    unreadByLink, setUnreadByLink, readMarkersVersion, setReadMarkersVersion, readMarkersRef,
    readMessageIds, setReadMessageIds, readReceiptsVersion, setReadReceiptsVersion, readReceiptsRef,
    removingMessageIds, setRemovingMessageIds, deletingShift, setDeletingShift
  } = messageInteractionStateModel;

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const [lastOfflineAtByUserId, setLastOfflineAtByUserId] = useState<Record<string, number>>({});

  const [presenceNowTs, setPresenceNowTs] = useState(() => Date.now());

  useEffect(() => {
    return observePeerPresence({ selfId, profileData, roleModalMember, activeConversationRef, groupModalData, channelModalData, chatsRef, setPresenceNowTs, setOnlineUserIds, setLastOfflineAtByUserId });
  }, [selfId, chats.length, activeConversation?.conversationId, profileData?.id, roleModalMember?.id, groupModalData?.group?.id, groupModalData?.members.length, channelModalData?.channel?.id, channelModalData?.subscribers?.length, channelModalData?.members?.length]);

  const recorderPresentationStateModel = useRecorderPresentationState();
  const {
    typingByLink, setTypingByLink, recordingByLink, setRecordingByLink, sendingByLink,
    setSendingByLink, composerRecordMode, setComposerRecordMode, recordModeHintUntil, setRecordModeHintUntil,
    voiceRecording, setVoiceRecording, voiceRecordingLocked, setVoiceRecordingLocked, voiceRecordingMs,
    setVoiceRecordingMs, voiceRecordingStream, setVoiceRecordingStream, videoRecordingStream, setVideoRecordingStream,
    videoRecorderOpen, setVideoRecorderOpen, videoRecording, setVideoRecording, videoCameraSwitching,
    setVideoCameraSwitching, videoRecordingLocked, setVideoRecordingLocked, recordingLocksRef
  } = recorderPresentationStateModel;

  recordingLocksRef.current = { voice: voiceRecordingLocked, video: videoRecordingLocked };

  const composerInteractionStateModel = useComposerInteractionState();
  const {
    voiceStartInProgressRef, videoOpenInProgressRef, videoRecordingMs, setVideoRecordingMs, videoFacingMode,
    setVideoFacingMode, replyToMessageId, setReplyToMessageId, editTarget, setEditTarget,
    editSaving, setEditSaving, swipeMessageId, setSwipeMessageId, swipeOffsetX,
    setSwipeOffsetX, profileFetchInFlightRef, queuedProfileFetchIdsRef, queuedProfileFetchTimerRef, queuedProfileFetchPromiseRef,
    chatListLongPressTimerRef, chatListLongPressTriggeredRef, chatListSuppressClickLinkRef, typingStopTimerRef, typingResetByLinkRef,
    recordingResetByLinkRef, sendingResetByLinkRef, recordingHeartbeatRef, sendingHeartbeatRef, lastTypingSentAtRef,
    lastTypingValueRef, voiceHoldActiveRef, preventPickerCloseOnFocusRef
  } = composerInteractionStateModel;

  useEffect(() => {
    return observeChatAppearance({ setLiveBackgroundPreset, setLiveBackgroundOpacity, setLiveBackgroundMotionSpeed, setMessageThemeEnabled, setTransparentVisual, setCustomTheme, setCustomThemeEnabled });
  }, []);

  useEffect(() => {
    return () => {
      if (queuedProfileFetchTimerRef.current) {
        clearTimeout(queuedProfileFetchTimerRef.current);
        queuedProfileFetchTimerRef.current = null;
      }
      queuedProfileFetchIdsRef.current.clear();
      queuedProfileFetchPromiseRef.current = null;
    };
  }, []);

  return {
    t,
    reducedPanelMotion,
    detailsPanelMotion,
    isMobile,
    router,
    pathname,
    searchParams,
    requestedChatLink,
    requestedChatType,
    requestedCreateKind,
    requestedSettingsParam,
    selection: selectionStateModel,
    storyDraft: storyDraftStateModel,
    attachmentDraft: attachmentDraftStateModel,
    conversation: conversationStateModel,
    wallpaperUpload: wallpaperUploadStateModel,
    pollResults,
    setPollResults,
    fetchPollResults,
    handlePollVote,
    account: accountStateModel,
    storyFeed,
    identity: identityStateModel,
    conversationRequest: conversationRequestStateModel,
    pollDraft: pollDraftStateModel,
    panels: panelsStateModel,
    hideChatActionPanel,
    showChatActionPanel,
    beginMessageSend,
    endMessageSend,
    setErrorText,
    sharedKeyWarmupAtRef,
    locallyHiddenMessageIds,
    setLocallyHiddenMessageIds,
    avatarViewerData,
    setAvatarViewerData,
    openAvatarViewer,
    profileModalOpen,
    setProfileModalOpen,
    detailsTargetRef,
    profileNavigation: profileNavigationStateModel,
    groupDetails: groupDetailsStateModel,
    memberContextMenu,
    memberRole: memberRoleStateModel,
    mediaAndChannel: mediaAndChannelStateModel,
    userDetails: userDetailsStateModel,
    handleProfileScroll,
    profileError,
    setProfileError,
    profileData,
    setProfileData,
    profileDataRef,
    secretChatCheckPendingRef,
    profileIsSaved,
    profileIsEclipse,
    profileIsBot,
    contactEditor: contactEditorStateModel,
    contactDraftDisplayName,
    chatListMenuOpen,
    setChatListMenuOpen,
    directoryMenu: directoryMenuStateModel,
    otherAccountsUnreadCount,
    handleSwitchAccount,
    handleAddAccountClick,
    chatSearchOpen,
    setChatSearchOpen,
    recentSearches,
    setRecentSearches,
    directorySearch: directorySearchStateModel,
    deferredChatSearchQuery,
    chatSearchInputRef,
    settingsPanelOpen,
    setSettingsPanelOpen,
    settingsPanelCovered,
    setSettingsPanelCovered,
    settingsDrawerLoaded,
    settingsControls: settingsControlsStateModel,
    createChatNavDirection,
    profileNavDirection,
    groupNavDirection,
    channelNavDirection,
    secretChatDraft: secretChatDraftStateModel,
    handleSecretChatPresetSelect,
    handledCreateParamRef,
    filteredCreateChatContacts,
    notificationAndContacts: notificationAndContactsStateModel,
    activeCustomTheme,
    transparentVisual,
    liveBackgroundLayerSettings,
    liveBgPresetColors,
    appearance: appearanceStateModel,
    messageHelperReadListOpen,
    setMessageHelperReadListOpen,
    messageInteraction: messageInteractionStateModel,
    onlineUserIds,
    lastOfflineAtByUserId,
    presenceNowTs,
    setPresenceNowTs,
    recorderPresentation: recorderPresentationStateModel,
    composerInteraction: composerInteractionStateModel
  };
}
