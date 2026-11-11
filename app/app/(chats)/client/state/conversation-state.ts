"use client";
import type { MessageSizeSubscription } from "@/lib/client/message-size-observer";
import type { MessageDeletionShift } from "../message-deletion-layout";

import { createChatBottomScroll } from "@/lib/client/chat-bottom-scroll";
import { useRef, useState } from "react";
import { type ForwardRecipient } from "../../components/common/ForwardRecipientPicker";
import { type ForwardedContent } from "@/lib/client/message-forwarding";
import { type ConversationChatType, type ChatSummary, type ChatSearchScope, type ChatSearchUser, type ChatSearchGroup, type ChatSearchChannel, type ChatSearchSaved, type ChatSearchEclipse, type DecryptedMessage, type ConversationResponse, type GroupModalData, type ChannelModalData, type ProfileBatchItem, type ChatActionPanelState } from "../../types";

export function useChatSelectionState(requestedChatLink: string | null) {
  const [selectedLink, setSelectedLink] = useState<string | null>(requestedChatLink);
  const selectedLinkRef = useRef<string | null>(requestedChatLink);
  const selectedSearchTargetRef = useRef<{ link: string; chatType: ConversationChatType; isBot?: boolean } | null>(null);
  const selectedLinkChangedAtRef = useRef(0);
  const [messageText, setMessageText] = useState("");
  return {
    selectedLink,
    setSelectedLink,
    selectedLinkRef,
    selectedSearchTargetRef,
    selectedLinkChangedAtRef,
    messageText,
    setMessageText
  };
}

export function useConversationState() {
  const [composerPickerTab, setComposerPickerTab] = useState<"emoji" | "stickers" | "gif">("emoji");
  const [stickerPickerPackId, setStickerPickerPackId] = useState<string>("all");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const chatsRef = useRef<ChatSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationResponse | null>(null);
  const [mediaReadyVersion, setMediaReadyVersion] = useState(0);
  const [startingBot, setStartingBot] = useState(false);
  const botStartRequestRef = useRef<{ link: string; requestId: string } | null>(null);
  const activeConversationRef = useRef<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  return {
    composerPickerTab,
    setComposerPickerTab,
    stickerPickerPackId,
    setStickerPickerPackId,
    attachmentMenuOpen,
    setAttachmentMenuOpen,
    chats,
    setChats,
    chatsRef,
    activeConversation,
    setActiveConversation,
    mediaReadyVersion,
    setMediaReadyVersion,
    startingBot,
    setStartingBot,
    botStartRequestRef,
    activeConversationRef,
    messages,
    setMessages
  };
}

export function useConversationRequestState() {
  const [syncing, setSyncing] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [decryptingConversation, setDecryptingConversation] = useState(false);
  const [, setLoadingChats] = useState(false);
  const [chatListResolvedOnce, setChatListResolvedOnce] = useState(false);
  const [sending, setSending] = useState(false);
  const activeSendCountRef = useRef(0);
  const sendingMessageInFlightRef = useRef(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  return {
    syncing,
    setSyncing,
    loadingConversation,
    setLoadingConversation,
    decryptingConversation,
    setDecryptingConversation,
    setLoadingChats,
    chatListResolvedOnce,
    setChatListResolvedOnce,
    sending,
    setSending,
    activeSendCountRef,
    sendingMessageInFlightRef,
    sendingMedia,
    setSendingMedia
  };
}

export function useChatPanelsState() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopDetailsPanelOpen, setDesktopDetailsPanelOpen] = useState(false);
  const [inspectedDetailsEntity, setInspectedDetailsEntity] = useState<{
    type: "direct" | "group" | "channel";
    link: string;
  } | null>(null);
  const [chatActionPanel, setChatActionPanel] = useState<ChatActionPanelState | null>(null);
  const [, setErrorTextState] = useState<string | null>(null);
  const chatActionPanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<{
    messageId: string;
    link: string;
    chatType: ConversationChatType;
    previousMessages: DecryptedMessage[];
    finalizeTimer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const pendingSelectionDeleteRef = useRef<{
    messageIds: string[];
    link: string;
    chatType: ConversationChatType;
    previousMessages: DecryptedMessage[];
    previousHiddenMessageIds: string[];
    mode: "mine" | "everyone";
    finalizeTimer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  return {
    isDesktop,
    setIsDesktop,
    desktopDetailsPanelOpen,
    setDesktopDetailsPanelOpen,
    inspectedDetailsEntity,
    setInspectedDetailsEntity,
    chatActionPanel,
    setChatActionPanel,
    setErrorTextState,
    chatActionPanelTimeoutRef,
    pendingDeleteRef,
    pendingSelectionDeleteRef
  };
}

export function useChatDirectoryMenuState() {
  const [chatListMenuPosition, setChatListMenuPosition] = useState<{ left: number; top: number }>({ left: 16, top: 70 });
  const [chatListMenuOrigin, setChatListMenuOrigin] = useState<string>("20px 0px");
  const [menuShowMore, setMenuShowMore] = useState(false);
  const accountsRequestPending = useRef(false);
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{
    id: string;
    displayName: string;
    link: string;
    avatarUrl: string | null;
    isActive: boolean;
    unreadCount?: number;
  }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = window.localStorage.getItem("eclipse:connected-accounts");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(account => ({ ...account, unreadCount: 0 }));
      }
    } catch { }
    return [];
  });
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);
  return {
    chatListMenuPosition,
    setChatListMenuPosition,
    chatListMenuOrigin,
    setChatListMenuOrigin,
    menuShowMore,
    setMenuShowMore,
    accountsRequestPending,
    connectedAccounts,
    setConnectedAccounts,
    switchingAccountId,
    setSwitchingAccountId,
    isAccountsExpanded,
    setIsAccountsExpanded
  };
}

export function useChatDirectorySearchState() {
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchScope, setChatSearchScope] = useState<ChatSearchScope>("all");
  const [chatSearchLoading, setChatSearchLoading] = useState(false);
  const [chatSearchError, setChatSearchError] = useState<string | null>(null);
  const [chatSearchUsers, setChatSearchUsers] = useState<ChatSearchUser[]>([]);
  const [chatSearchGroups, setChatSearchGroups] = useState<ChatSearchGroup[]>([]);
  const [chatSearchChannels, setChatSearchChannels] = useState<ChatSearchChannel[]>([]);
  const [chatSearchSaved, setChatSearchSaved] = useState<ChatSearchSaved[]>([]);
  const [chatSearchEclipse, setChatSearchEclipse] = useState<ChatSearchEclipse[]>([]);
  return {
    chatSearchQuery,
    setChatSearchQuery,
    chatSearchScope,
    setChatSearchScope,
    chatSearchLoading,
    setChatSearchLoading,
    chatSearchError,
    setChatSearchError,
    chatSearchUsers,
    setChatSearchUsers,
    chatSearchGroups,
    setChatSearchGroups,
    chatSearchChannels,
    setChatSearchChannels,
    chatSearchSaved,
    setChatSearchSaved,
    chatSearchEclipse,
    setChatSearchEclipse
  };
}

export function useMessageInteractionState() {
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [messageHelperHorizontalPlacement, setMessageHelperHorizontalPlacement] = useState<
    "outside-left" | "outside-right"
  >("outside-right");
  const [forwardPickerMode, setForwardPickerMode] = useState<"forward" | "share">("forward");
  const [forwardPickerMessages, setForwardPickerMessages] = useState<Array<ForwardedContent & { requestId: string; preparedContent?: string }> | null>(null);
  const [forwardDraft, setForwardDraft] = useState<{ link: string; chatType: ForwardRecipient["chatType"]; share?: boolean; messages: Array<ForwardedContent & { requestId: string; preparedContent?: string }> } | null>(null);
  const [forwardSending, setForwardSending] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectionDeleting, setSelectionDeleting] = useState(false);
  const [selectionDeleteDialogOpen, setSelectionDeleteDialogOpen] = useState(false);
  const [externalLinkPrompt, setExternalLinkPrompt] = useState<{ url: string; host: string } | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [chatsCursor, setChatsCursor] = useState<string | null>(null);
  const [hasMoreChats, setHasMoreChats] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const [unreadByLink, setUnreadByLink] = useState<Record<string, number>>({});
  const [readMarkersVersion, setReadMarkersVersion] = useState(0);
  const readMarkersRef = useRef<Record<string, string>>({});
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const [readReceiptsVersion, setReadReceiptsVersion] = useState(0);
  const readReceiptsRef = useRef<Record<string, string>>({});
  const [removingMessageIds, setRemovingMessageIds] = useState<Set<string>>(new Set());
  const [deletingShift, setDeletingShift] = useState<MessageDeletionShift | null>(null);
  return {
    highlightedMessageId,
    setHighlightedMessageId,
    messageHelperHorizontalPlacement,
    setMessageHelperHorizontalPlacement,
    forwardPickerMode,
    setForwardPickerMode,
    forwardPickerMessages,
    setForwardPickerMessages,
    forwardDraft,
    setForwardDraft,
    forwardSending,
    setForwardSending,
    selectionMode,
    setSelectionMode,
    selectedMessageIds,
    setSelectedMessageIds,
    selectionDeleting,
    setSelectionDeleting,
    selectionDeleteDialogOpen,
    setSelectionDeleteDialogOpen,
    externalLinkPrompt,
    setExternalLinkPrompt,
    deletingMessageId,
    setDeletingMessageId,
    chatsCursor,
    setChatsCursor,
    hasMoreChats,
    setHasMoreChats,
    loadingMoreChats,
    setLoadingMoreChats,
    unreadByLink,
    setUnreadByLink,
    readMarkersVersion,
    setReadMarkersVersion,
    readMarkersRef,
    readMessageIds,
    setReadMessageIds,
    readReceiptsVersion,
    setReadReceiptsVersion,
    readReceiptsRef,
    removingMessageIds,
    setRemovingMessageIds,
    deletingShift,
    setDeletingShift
  };
}

export function useConversationElementRefs() {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoInputDeviceIdsRef = useRef<string[]>([]);
  const activeVideoDeviceIdRef = useRef<string | null>(null);
  const videoCameraSwitchInProgressRef = useRef(false);
  const skipMicTapRef = useRef(false);
  const pusherRef = useRef<{ disconnect: () => void } | null>(null);
  const realtimeSelfIdRef = useRef<string | null>(null);
  const decryptedPreviewFingerprintRef = useRef<Record<string, string>>({});
  const peerPublicKeyByLinkRef = useRef<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const channelAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const chatListViewportRef = useRef<HTMLDivElement | null>(null);
  const messageSwipeStartRef = useRef<{ id: string; x: number; y: number; isMine: boolean } | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const chatReadingPositionsRef = useRef(new Map<string, { messageId: string; offset: number; top: number; createdAt: string }>());
  const chatScrollRef = useRef<{ key: string; link: string; initial: boolean; lastMessageId?: string; requestedBefore?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const videoViewerRef = useRef<HTMLVideoElement | null>(null);
  const messageLongPressTimerRef = useRef<number | null>(null);
  const messageLongPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const messageLongPressTriggeredRef = useRef(false);
  const draftBeforeEditRef = useRef<string>("");
  const editPrefillTargetIdRef = useRef<string | null>(null);
  const groupModalCacheRef = useRef(
    new Map<string, { savedAt: number; data: GroupModalData }>(),
  );
  const channelModalCacheRef = useRef(new Map<string, { savedAt: number; data: ChannelModalData }>());
  const profileDetailsInFlightRef = useRef<Set<string>>(new Set());
  const groupDetailsInFlightRef = useRef<Set<string>>(new Set());
  const channelDetailsInFlightRef = useRef<Set<string>>(new Set());
  const contactsForAddCacheRef = useRef<{
    savedAt: number;
    contacts: Array<{ id: string; link: string; alias: string; avatarUrl?: string | null; displayName?: string }>;
  } | null>(null);
  const messageRowObserversRef = useRef<Record<string, MessageSizeSubscription>>({});
  const messageRowRefCallbacksRef = useRef<Record<string, (node: HTMLDivElement | null) => void>>({});
  const deleteAnimationTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const deletedMessageTombstonesRef = useRef<Map<string, number>>(new Map());
  return {
    videoPreviewRef,
    videoInputDeviceIdsRef,
    activeVideoDeviceIdRef,
    videoCameraSwitchInProgressRef,
    skipMicTapRef,
    pusherRef,
    realtimeSelfIdRef,
    decryptedPreviewFingerprintRef,
    peerPublicKeyByLinkRef,
    imageInputRef,
    groupAvatarInputRef,
    channelAvatarInputRef,
    chatListViewportRef,
    messageSwipeStartRef,
    messagesViewportRef,
    chatReadingPositionsRef,
    chatScrollRef,
    messagesEndRef,
    videoViewerRef,
    messageLongPressTimerRef,
    messageLongPressStartRef,
    messageLongPressTriggeredRef,
    draftBeforeEditRef,
    editPrefillTargetIdRef,
    groupModalCacheRef,
    channelModalCacheRef,
    profileDetailsInFlightRef,
    groupDetailsInFlightRef,
    channelDetailsInFlightRef,
    contactsForAddCacheRef,
    messageRowObserversRef,
    messageRowRefCallbacksRef,
    deleteAnimationTimersRef,
    deletedMessageTombstonesRef
  };
}

export function useConversationScrollRefs() {
  const messagesAtBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const lastObservedMessagesScrollTopRef = useRef(0);
  const messagesTouchYRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const isScrollingToBottomRef = useRef(false);
  const bottomScrollAnimationRef = useRef<ReturnType<typeof createChatBottomScroll> | null>(null);
  return {
    messagesAtBottomRef,
    userScrolledUpRef,
    lastObservedMessagesScrollTopRef,
    messagesTouchYRef,
    programmaticScrollRef,
    isScrollingToBottomRef,
    bottomScrollAnimationRef
  };
}

export function useMessageDeliveryRefs() {
  const userSentMessageRef = useRef(false);
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);
  const sentReadReceiptIdsRef = useRef<Set<string>>(new Set());
  const readReceiptEndpointUnsupportedRef = useRef(false);
  const messageHeightsRef = useRef<Record<string, number>>({});
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [footerHeight, setFooterHeight] = useState(64);
  const reactionInFlightRef = useRef<Set<string>>(new Set());
  const reactionPulseTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  return {
    userSentMessageRef,
    lastTapRef,
    sentReadReceiptIdsRef,
    readReceiptEndpointUnsupportedRef,
    messageHeightsRef,
    footerRef,
    footerHeight,
    setFooterHeight,
    reactionInFlightRef,
    reactionPulseTimersRef
  };
}

export function useConversationRequestRefs() {
  const [reactionPulseVersions, setReactionPulseVersions] = useState<Record<string, number>>({});
  const conversationRequestSeqRef = useRef(0);
  const listCacheHydratedRef = useRef(false);
  const inflightHydrationRef = useRef<Set<string>>(new Set());
  const inflightChatListRequestKeyRef = useRef<string | null>(null);
  const loadingMoreChatsRef = useRef(false);
  const openConversationInFlightRef = useRef<Map<string, number>>(new Map());
  const lastHandledSelectedLinkRef = useRef<string | null>(null);
  const openConversationRef = useRef<
    (link: string, options?: { force?: boolean; revalidate?: boolean; chatType?: ConversationChatType }) => Promise<void>
  >(async () => { });
  const loadOlderMessagesRef = useRef<(() => Promise<void>) | null>(null);
  const preservingHistoryScrollRef = useRef(false);
  const prependScrollSnapshotRef = useRef<{ previousHeight: number; previousTop: number } | null>(null);
  const chatListScrollRafRef = useRef<number | null>(null);
  const messagesScrollRafRef = useRef<number | null>(null);
  const lastChatListScrollTopRef = useRef(0);
  const lastCommittedChatListScrollTopRef = useRef(0);
  const pendingChatListScrollTopRef = useRef(0);
  const pendingMobileHeaderOffsetRef = useRef(0);
  const mobileHeaderOffsetRef = useRef(0);
  const chatListTouchStartRef = useRef<{ y: number; x: number; top: number } | null>(null);
  const [chatListScrollTop, setChatListScrollTop] = useState(0);
  const [mobileChatViewportHeight, setMobileChatViewportHeight] = useState<number | null>(null);
  return {
    reactionPulseVersions,
    setReactionPulseVersions,
    conversationRequestSeqRef,
    listCacheHydratedRef,
    inflightHydrationRef,
    inflightChatListRequestKeyRef,
    loadingMoreChatsRef,
    openConversationInFlightRef,
    lastHandledSelectedLinkRef,
    openConversationRef,
    loadOlderMessagesRef,
    preservingHistoryScrollRef,
    prependScrollSnapshotRef,
    chatListScrollRafRef,
    messagesScrollRafRef,
    lastChatListScrollTopRef,
    lastCommittedChatListScrollTopRef,
    pendingChatListScrollTopRef,
    pendingMobileHeaderOffsetRef,
    mobileHeaderOffsetRef,
    chatListTouchStartRef,
    chatListScrollTop,
    setChatListScrollTop,
    mobileChatViewportHeight,
    setMobileChatViewportHeight
  };
}

export function useRealtimeHandlerRefs(decryptMessageWithRecovery: (params: { privateKey: CryptoKey; cipherText: string; iv: string; encryptedKey: string; }) => Promise<string>, ensureOwnE2EReady: (options?: { allowPrompt?: boolean | undefined; } | undefined) => Promise<{ privateKey: CryptoKey; publicKeyBase64: string; privateKeyBase64: string | null; }>, ensureProfilesBatch: (userIds: string[]) => Promise<void>, ensureSharedKeyForMembers: (chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[] | undefined) => Promise<{ version: number; added: number; failedVersions: number[]; } | null>, rotateSharedKey: (chatType: "group" | "channel", link: string, chatId: string) => Promise<{ version: number; keyBase64: string; createdAt: number; }>, readProfileFromCache: (userId: string) => import("@/app/app/(chats)/types").ProfileBatchItem | null, animateDeleteMessage: (messageId: string, link: string, chatType?: import("@/app/app/(chats)/types").ConversationChatType) => void, handleSecretChatExpired: (expiredChatId?: string | undefined) => void) {
  const decryptMessageWithRecoveryRef = useRef(decryptMessageWithRecovery);
  const ensureOwnE2EReadyRef = useRef(ensureOwnE2EReady);
  const ensureProfilesBatchRef = useRef(ensureProfilesBatch);
  const ensureSharedKeyForMembersRef = useRef(ensureSharedKeyForMembers);
  const rotateSharedKeyRef = useRef(rotateSharedKey);
  const readProfileFromCacheRef = useRef(readProfileFromCache);
  const messagesRef = useRef<DecryptedMessage[]>([]);
  const animateDeleteMessageRef = useRef(animateDeleteMessage);
  const handleSecretChatExpiredRef = useRef(handleSecretChatExpired);
  return {
    decryptMessageWithRecoveryRef,
    ensureOwnE2EReadyRef,
    ensureProfilesBatchRef,
    ensureSharedKeyForMembersRef,
    rotateSharedKeyRef,
    readProfileFromCacheRef,
    messagesRef,
    animateDeleteMessageRef,
    handleSecretChatExpiredRef
  };
}
