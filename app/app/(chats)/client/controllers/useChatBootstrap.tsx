"use client";

import { useAccountNavigationRefs } from "../state/account-state";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { apiRequest } from "@/lib/client/http";

import { type ConversationChatType, type ChatSummary, type GroupModalData, type ChannelModalData, type ProfileBatchItem } from "../../types";

import { profileByIdInMemoryCache, chatMemory, saveChatListSessionCache, saveChatListPersistentCache } from "../chat-cache";

import { PROFILE_CACHE_TTL_MS } from "../config";

import { isLikelyPublicLink } from "../message-links";
import { useIsomorphicLayoutEffect } from "../use-client-layout-effect";

import { refreshActiveChatDetails, synchronizeRequestedChat, prewarmSharedKeysForChatPreviewsAction, hydrateCachedAccount, loadSecretChatsAction } from "../chat-lifecycle";
import {
  bootstrapChatIdentity,
  loadChatPageAction,
  subscribeProfileChanges,
  restoreThemeWallpaperPreviews,
  decryptChatListPreviews,
  mergeProfilesToCacheAction,
  ensureProfilesBatchAction
} from "../chat-bootstrap";
import { openConversationAction } from "../open-conversation";

import type { ActiveConversationModel } from "./useActiveConversation";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { MessageReactionsModel } from "./useMessageReactions";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ChatBootstrapSources {
  active: Pick<ActiveConversationModel, "activeChat" | "selectedChat">;
  page: Pick<ChatPageStateModel, "t" | "settingsPanelOpen" | "router" | "setProfileData" | "searchParams" | "pathname" | "sharedKeyWarmupAtRef" | "requestedChatLink" | "requestedChatType" | "setErrorText" | "setProfileModalOpen"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "setChats" | "setActiveConversation" | "messages" | "setMessages" | "chatsRef" | "chats" | "activeConversationRef">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "animatedMessageIdsRef" | "suppressMessageEntranceRef" | "setSelfId" | "setSelfProfile">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalData" | "setChannelSubView" | "setChannelNameEditing">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "setGroupSubView" | "setGroupNameEditing" | "setGroupModalData">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "setProfileSubView">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "setContactEditorTarget" | "setContactExists" | "bumpProfileBatchVersion">;
    panels: Pick<ChatPageStateModel["panels"], "setIsDesktop" | "isDesktop" | "setInspectedDetailsEntity" | "setDesktopDetailsPanelOpen">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "chatListHelper" | "setChatListHelper">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "selectedLink" | "selectedLinkChangedAtRef" | "setSelectedLink" | "selectedSearchTargetRef">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "setReplyToMessageId" | "setSwipeMessageId" | "setSwipeOffsetX" | "setEditTarget" | "profileFetchInFlightRef" | "queuedProfileFetchIdsRef" | "queuedProfileFetchPromiseRef" | "queuedProfileFetchTimerRef">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "setDecryptingConversation" | "setLoadingChats" | "setChatListResolvedOnce" | "setSyncing" | "setLoadingConversation">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "loadingMoreChats" | "setUnreadByLink" | "setHasMoreChats" | "setChatsCursor" | "readMarkersRef" | "readReceiptsRef" | "setLoadingMoreChats" | "unreadByLink" | "hasMoreChats" | "chatsCursor">;
    identity: Pick<ChatPageStateModel["identity"], "e2eIdentityReady" | "setPrivateKey" | "setSelfPublicKey" | "setE2EIdentityReady" | "setE2EBootstrapCompleted" | "privateKey" | "cryptoDiagnosticRef" | "privateKeyRef">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryFeed" | "skipNextInitialStoriesReloadRef" | "setStoriesLoading" | "skipNextInitialChatReloadRef" | "setStoryReplyTarget">;
    appearance: Pick<ChatPageStateModel["appearance"], "setMessageHelperId">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "setSecretChatExpiresAt">;

  };
  elements: Pick<ChatElementStateModel, "sanitizeMessages"> & {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "profileDetailsInFlightRef" | "groupModalCacheRef" | "groupDetailsInFlightRef" | "channelModalCacheRef" | "channelDetailsInFlightRef" | "contactsForAddCacheRef" | "decryptedPreviewFingerprintRef" | "peerPublicKeyByLinkRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "loadingMoreChatsRef" | "listCacheHydratedRef" | "inflightHydrationRef" | "openConversationInFlightRef" | "inflightChatListRequestKeyRef" | "conversationRequestSeqRef" | "openConversationRef">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "sentReadReceiptIdsRef" | "reactionInFlightRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "setHasMoreMessagesBefore">;

  };
  interaction: Pick<ChatInteractionModel, "clearChatListLongPress" | "setReadReceiptMarker">;
  callbacks: Pick<ChatPageCallbacks, "ensureCreateChatContacts" | "sendReadReceipt">;
}

export interface ChatBootstrapDeferred {
  readonly history: Pick<MessageHistoryModel, "sharedKeyServerCacheRef" | "resolveAndSyncOwnE2EIdentity" | "decryptMessageWithRecovery" | "ensureOwnE2EReady" | "buildSharedChatKeyId" | "loadSharedKeyByVersion" | "ensureSharedKeyFromServer">;
  readonly reactions: {
    realtimeHandler: Pick<MessageReactionsModel["realtimeHandler"], "messagesRef">;

  };
}
export interface ChatBootstrapModel {
  activeGroupModalSeed: import("@/app/app/(chats)/types").GroupModalData | null;
  activeChannelModalSeed: import("@/app/app/(chats)/types").ChannelModalData | null;
  accountNavigation: ReturnType<typeof useAccountNavigationRefs>;
  ensureSharedKeyFromServerRef: React.RefObject<((chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{
    version: number;
    keyBase64: string;
    createdAt: number;

  } | null>) | null>;
  prewarmSharedKeysForChatPreviews: (chatItems: import("@/app/app/(chats)/types").ChatSummary[]) => Promise<void>;
  loadSecretChatsRef: React.RefObject<() => Promise<void>>;
  loadChatPage: (cursor: string | null, mode: "replace" | "append") => Promise<void>;
  readProfileFromCache: (userId: string) => import("@/app/app/(chats)/types").ProfileBatchItem | null;
  ensureProfilesBatch: (userIds: string[]) => Promise<void>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatBootstrap(sources: ChatBootstrapSources, deferred: ChatBootstrapDeferred): ChatBootstrapModel {
  const { activeChat, selectedChat } = sources.active;
  const { t, settingsPanelOpen, router, setProfileData, searchParams, pathname, sharedKeyWarmupAtRef, requestedChatLink, requestedChatType, setErrorText, setProfileModalOpen } = sources.page;
  const { activeConversation, setChats, setActiveConversation, messages, setMessages, chatsRef, chats, activeConversationRef } = sources.page.conversation;
  const { selfId, animatedMessageIdsRef, suppressMessageEntranceRef, setSelfId, setSelfProfile } = sources.page.account;
  const { channelModalData, setChannelSubView, setChannelNameEditing } = sources.page.mediaAndChannel;
  const { setGroupSubView, setGroupNameEditing, setGroupModalData } = sources.page.groupDetails;
  const { setProfileSubView } = sources.page.profileNavigation;
  const { setContactEditorTarget, setContactExists, bumpProfileBatchVersion } = sources.page.contactEditor;
  const { setIsDesktop, isDesktop, setInspectedDetailsEntity, setDesktopDetailsPanelOpen } = sources.page.panels;
  const { chatListHelper, setChatListHelper } = sources.page.notificationAndContacts;
  const { selectedLinkRef, selectedLink, selectedLinkChangedAtRef, setSelectedLink, selectedSearchTargetRef } = sources.page.selection;
  const { setReplyToMessageId, setSwipeMessageId, setSwipeOffsetX, setEditTarget, profileFetchInFlightRef, queuedProfileFetchIdsRef, queuedProfileFetchPromiseRef, queuedProfileFetchTimerRef } = sources.page.composerInteraction;
  const { setDecryptingConversation, setLoadingChats, setChatListResolvedOnce, setSyncing, setLoadingConversation } = sources.page.conversationRequest;
  const { loadingMoreChats, setUnreadByLink, setHasMoreChats, setChatsCursor, readMarkersRef, readReceiptsRef, setLoadingMoreChats, unreadByLink, hasMoreChats, chatsCursor } = sources.page.messageInteraction;
  const { e2eIdentityReady, setPrivateKey, setSelfPublicKey, setE2EIdentityReady, setE2EBootstrapCompleted, privateKey, cryptoDiagnosticRef, privateKeyRef } = sources.page.identity;
  const { setStoryFeed, skipNextInitialStoriesReloadRef, setStoriesLoading, skipNextInitialChatReloadRef, setStoryReplyTarget } = sources.page.storyDraft;
  const { setMessageHelperId } = sources.page.appearance;
  const { setSecretChatExpiresAt } = sources.page.secretChatDraft;
  const { sanitizeMessages } = sources.elements;
  const { profileDetailsInFlightRef, groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef, contactsForAddCacheRef, decryptedPreviewFingerprintRef, peerPublicKeyByLinkRef } = sources.elements.conversationElement;
  const { loadingMoreChatsRef, listCacheHydratedRef, inflightHydrationRef, openConversationInFlightRef, inflightChatListRequestKeyRef, conversationRequestSeqRef, openConversationRef } = sources.elements.conversationRequest;
  const { sentReadReceiptIdsRef, reactionInFlightRef } = sources.elements.messageDelivery;
  const { setHasMoreMessagesBefore } = sources.elements.storyAndViewport;
  const { clearChatListLongPress, setReadReceiptMarker } = sources.interaction;
  const { ensureCreateChatContacts, sendReadReceipt } = sources.callbacks;

  const activeGroupModalSeed = useMemo<GroupModalData | null>(() => {
    if (!activeChat || activeChat.chatType !== "group") return null;
    const activeGroup =
      activeConversation?.chatType === "group" && activeConversation.group?.link === activeChat.link
        ? activeConversation.group
        : null;

    return {
      group: {
        id: activeGroup?.id ?? activeChat.peerId,
        link: activeGroup?.link ?? activeChat.link,
        name: activeGroup?.name ?? activeChat.displayName,
        avatarUrl: activeGroup?.avatarUrl ?? activeChat.avatarUrl ?? null,
        ownerId: activeGroup?.ownerId,
        myRole: activeGroup?.myRole ?? (activeChat.isGroupOwner ? "owner" : undefined),
        myCanChangeReactions: Boolean(activeChat.isGroupOwner || activeGroup?.myCanChangeReactions),
        myCanPinMessages: Boolean(activeChat.isGroupOwner || activeGroup?.myCanPinMessages),
        myCanAddMembers:
          activeGroup?.myRole === "owner" || activeGroup?.myRole === "admin" || activeChat.isGroupOwner || undefined,
        isPublic: isLikelyPublicLink(activeGroup?.link ?? activeChat.link),
      },
      members: activeGroup ? activeConversation?.members ?? [] : [],
    };
  }, [activeChat, activeConversation]);

  const activeChannelModalSeed = useMemo<ChannelModalData | null>(() => {
    if (!activeChat || activeChat.chatType !== "channel") return null;
    const activeChannel =
      activeConversation?.chatType === "channel" && activeConversation.channel?.link === activeChat.link
        ? activeConversation.channel
        : null;
    const isOwner = Boolean(
      (activeChannel && selfId && activeChannel.ownerId === selfId) ||
      (activeChannel as any)?.isOwner ||
      (activeChannel as any)?.myRole === "owner" ||
      (activeChat as any).isChannelOwner ||
      (channelModalData?.channel?.link === activeChat.link && (channelModalData.channel.isOwner || channelModalData.channel.myRole === "owner"))
    );
    const ownerId = activeChannel?.ownerId ?? (isOwner ? selfId ?? "" : "");

    return {
      channel: {
        id: activeChannel?.id ?? activeChat.peerId,
        link: activeChannel?.link ?? activeChat.link,
        name: activeChannel?.name ?? activeChat.displayName,
        avatarUrl: activeChannel?.avatarUrl ?? activeChat.avatarUrl ?? null,
        ownerId,
        isOwner,
        isSubscribed: activeChannel?.isSubscribed ?? false,
        subscribersCount: activeChannel?.subscribersCount ?? activeChat.subscribersCount ?? "0",
        isPublic: isLikelyPublicLink(activeChannel?.link ?? activeChat.link),
        myRole: isOwner ? "owner" : ((activeChannel as any)?.myRole ?? "member"),
        myRoleLabel: isOwner ? t("создатель") : ((activeChannel as any)?.myRoleLabel ?? null),
        myCanPostMessages: isOwner ? true : Boolean((activeChannel as any)?.myCanPostMessages),
        myCanChangeAvatar: isOwner ? true : Boolean((activeChannel as any)?.myCanChangeAvatar),
        myCanChangeName: isOwner ? true : Boolean((activeChannel as any)?.myCanChangeName),
        myCanChangeReactions: isOwner ? true : Boolean((activeChannel as any)?.myCanChangeReactions),
        myCanPinMessages: isOwner ? true : Boolean((activeChannel as any)?.myCanPinMessages),
        myCanEditForeignMessages: isOwner ? true : Boolean((activeChannel as any)?.myCanEditForeignMessages),
        myCanDeleteForeignMessages: isOwner ? true : Boolean((activeChannel as any)?.myCanDeleteForeignMessages),
        myCanAddMembers: isOwner ? true : Boolean((activeChannel as any)?.myCanAddMembers),
        myCanGenerateInviteLink: isOwner ? true : Boolean((activeChannel as any)?.myCanGenerateInviteLink),
        myCanManageAdmins: isOwner ? true : Boolean((activeChannel as any)?.myCanManageAdmins),
      },
    };
  }, [activeChat, activeConversation, channelModalData?.channel, selfId, t]);

  const accountNavigationStateModel = useAccountNavigationRefs();
  const {
    activeChatLinkRef, currentUserIdRef, currentSessionIdRef, suppressRequestedChatSyncRef, communityNavigationIdentityRef
  } = accountNavigationStateModel;

  useEffect(() => {
    activeChatLinkRef.current = activeChat?.link ?? null;
    const identity = activeChat?.chatType === "group" || activeChat?.chatType === "channel"
      ? `${activeChat.chatType}:${activeChat.conversationId}` : null;
    const sameCommunity = identity !== null && identity === communityNavigationIdentityRef.current;
    communityNavigationIdentityRef.current = identity;
    if (sameCommunity) return;
    setChannelSubView(null);
    setGroupSubView(null);
    setProfileSubView(null);
    setGroupNameEditing(false);
    setChannelNameEditing(false);
  }, [activeChat?.link]);

  useEffect(() => {
    if (settingsPanelOpen) {
      setChannelSubView(null);
      setGroupSubView(null);
      setProfileSubView(null);
    }
  }, [settingsPanelOpen]);

  useEffect(() => {
    return refreshActiveChatDetails({ activeChat, activeConversation, router, selfId, setProfileData, setContactEditorTarget, setContactExists, setChats, profileDetailsInFlightRef, setActiveConversation, groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef });
  }, [activeChat?.link, activeChat?.chatType, activeConversation?.peer?.link, router, selfId]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!chatListHelper) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChatListHelper(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [chatListHelper]);

  useEffect(() => () => clearChatListLongPress(), [clearChatListLongPress]);

  useEffect(() => {
    selectedLinkRef.current = selectedLink;
    selectedLinkChangedAtRef.current = Date.now();
  }, [selectedLink]);

  const prevSelectedLinkRef = useRef<string | null>(null);

  useEffect(() => {
    const prevLink = prevSelectedLinkRef.current;
    prevSelectedLinkRef.current = selectedLink;
    if (prevLink && prevLink !== selectedLink) {
      setChats((prevChats) => {
        const chat = prevChats.find((c) => c.link === prevLink);
        if (chat && chat.isTemporary && !chat.lastMessage) {
          return prevChats.filter((c) => c.link !== prevLink);
        }
        return prevChats;
      });
    }
  }, [selectedLink]);

  useEffect(() => {
    return synchronizeRequestedChat({ searchParams, selectedLink, suppressRequestedChatSyncRef, setSelectedLink, activeConversation, selectedSearchTargetRef, selectedChat, pathname });
  }, [pathname, searchParams, selectedLink, selectedChat?.chatType, activeConversation]);

  useEffect(() => {
    animatedMessageIdsRef.current = new Set();
    suppressMessageEntranceRef.current = true;
  }, [selectedLink]);

  useEffect(() => {
    messages.forEach((message) => {
      animatedMessageIdsRef.current.add(message.id);
    });
    if (suppressMessageEntranceRef.current) {
      suppressMessageEntranceRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    setReplyToMessageId(null);
    setSwipeMessageId(null);
    setSwipeOffsetX(0);
    setEditTarget(null);
    setDecryptingConversation(false);
  }, [activeChat?.link]);

  useEffect(() => {
    loadingMoreChatsRef.current = loadingMoreChats;
  }, [loadingMoreChats]);

  const ensureSharedKeyFromServerRef = useRef<(
    (chatType: "group" | "channel", link: string, chatId: string, version?: number | null) =>
      Promise<{
        version: number;
        keyBase64: string;
        createdAt: number

      } | null>
  ) | null>(null);

  const prewarmSharedKeysForChatPreviews = useCallback(async (chatItems: ChatSummary[]) => {
    return prewarmSharedKeysForChatPreviewsAction({ e2eIdentityReady, ensureSharedKeyFromServerRef, sharedKeyWarmupAtRef }, chatItems);
  }, [e2eIdentityReady]);

  useIsomorphicLayoutEffect(() => {
    return hydrateCachedAccount({ listCacheHydratedRef, currentUserIdRef, setSelfId, setSelfProfile, setStoryFeed, setChats, setUnreadByLink, setHasMoreChats, setChatsCursor });
  }, [requestedChatLink, requestedChatType]);

  const loadSecretChats = useCallback(async () => {
    return loadSecretChatsAction({ selfId, t, setChats });
  }, [selfId, t]);

  const loadSecretChatsRef = useRef(loadSecretChats);

  useEffect(() => {
    loadSecretChatsRef.current = loadSecretChats;
  }, [loadSecretChats]);

  useEffect(() => {
    if (!selfId) return;
    void loadSecretChats();

    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadSecretChats();
      }
    }, 8000);

    const onFocus = () => {
      void loadSecretChats();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [selfId, loadSecretChats]);

  useEffect(() => {
    return bootstrapChatIdentity({ currentSessionIdRef, currentUserIdRef, setPrivateKey, setSelfPublicKey, setE2EIdentityReady, setE2EBootstrapCompleted, listCacheHydratedRef, setChats, setStoryFeed, setMessages, setUnreadByLink, setHasMoreChats, setChatsCursor, setActiveConversation, setMessageHelperId, setReplyToMessageId, setEditTarget, setSelectedLink, requestedChatLink, readMarkersRef, readReceiptsRef, sentReadReceiptIdsRef, profileFetchInFlightRef, profileDetailsInFlightRef, groupDetailsInFlightRef, channelDetailsInFlightRef, inflightHydrationRef, openConversationInFlightRef, reactionInFlightRef, sharedKeyWarmupAtRef, groupModalCacheRef, channelModalCacheRef, contactsForAddCacheRef, sharedKeyServerCacheRef: deferred.history.sharedKeyServerCacheRef, setSelfId, setSelfProfile, skipNextInitialStoriesReloadRef, setStoriesLoading, selectedLink, skipNextInitialChatReloadRef, setLoadingChats, setChatListResolvedOnce, setSyncing, resolveAndSyncOwnE2EIdentity: deferred.history.resolveAndSyncOwnE2EIdentity, setErrorText, ensureCreateChatContacts, t, loadChatPage });
  }, [t]);

  const loadChatPage = useCallback(
    async (cursor: string | null, mode: "replace" | "append") => {
      return loadChatPageAction({ loadingMoreChatsRef, setLoadingMoreChats, chatsRef, setLoadingChats, isDesktop, inflightChatListRequestKeyRef, setReadReceiptMarker, setChats, setUnreadByLink, setHasMoreChats, setChatsCursor, prewarmSharedKeysForChatPreviews, selectedLink, setStoryReplyTarget, setErrorText, t, setChatListResolvedOnce }, cursor, mode);
    },
    [isDesktop, prewarmSharedKeysForChatPreviews, setReadReceiptMarker, t],
  );

  useEffect(() => {
    if (skipNextInitialChatReloadRef.current) {
      skipNextInitialChatReloadRef.current = false;
      return;
    }
    void loadChatPage(null, "replace");
  }, [loadChatPage]);

  useEffect(() => {
    if (chats.length === 0) {
      return;
    }
    chatMemory.chatsListInMemoryCache = {
      savedAt: Date.now(),
      chats,
      unreadByLink,
      hasMoreChats,
      chatsCursor,
      selectedLink,
      selfId: selfId ?? undefined,
    };
    if (selfId) {
      saveChatListSessionCache(selfId, chatMemory.chatsListInMemoryCache);
      saveChatListPersistentCache(selfId, chatMemory.chatsListInMemoryCache);
    }
  }, [chats, unreadByLink, hasMoreChats, chatsCursor, selectedLink, selfId]);

  useEffect(() => {
    return subscribeProfileChanges({ setSelfProfile, setChats, setUnreadByLink, selectedLinkRef, setSelectedLink, setActiveConversation, setGroupModalData, groupModalCacheRef, setStoryFeed, setProfileData, selfId, bumpProfileBatchVersion });
  }, [selfId]);

  useEffect(() => {
    return restoreThemeWallpaperPreviews();
  }, []);

  useEffect(() => {
    return decryptChatListPreviews({ privateKey, chats, decryptedPreviewFingerprintRef, decryptMessageWithRecovery: deferred.history.decryptMessageWithRecovery, cryptoDiagnosticRef, setChats });
  }, [chats, privateKey, t]);

  const readProfileFromCache = useCallback((userId: string) => {
    const cached = profileByIdInMemoryCache.get(userId);
    if (!cached) return null;
    if (Date.now() - cached.savedAt > PROFILE_CACHE_TTL_MS) {
      profileByIdInMemoryCache.delete(userId);
      return null;
    }
    return cached.profile;
  }, []);

  const mergeProfilesToCache = useCallback((profiles: ProfileBatchItem[]) => {
    return mergeProfilesToCacheAction({ bumpProfileBatchVersion }, profiles);
  }, []);

  const flushQueuedProfilesBatch = useCallback(async () => {
    const pending = Array.from(queuedProfileFetchIdsRef.current).filter(
      (id) => !readProfileFromCache(id) && !profileFetchInFlightRef.current.has(id),
    );
    queuedProfileFetchIdsRef.current.clear();
    if (pending.length === 0) return;

    pending.forEach((id) => profileFetchInFlightRef.current.add(id));
    try {
      // The API accepts at most 200 IDs. Large histories must not lose the entire batch.
      for (let offset = 0; offset < pending.length; offset += 200) {
        const data = await apiRequest<{ profiles: ProfileBatchItem[] }>("/api/profiles", {
          method: "POST",
          body: JSON.stringify({ userIds: pending.slice(offset, offset + 200) }),
        });
        if (data?.profiles?.length) mergeProfilesToCache(data.profiles);
      }
    } catch {
      // batch profile fetch is best-effort
    } finally {
      pending.forEach((id) => profileFetchInFlightRef.current.delete(id));
    }
  }, [mergeProfilesToCache, readProfileFromCache]);

  const ensureProfilesBatch = useCallback(
    async (userIds: string[]) => {
      return ensureProfilesBatchAction({ readProfileFromCache, profileFetchInFlightRef, queuedProfileFetchIdsRef, queuedProfileFetchPromiseRef, queuedProfileFetchTimerRef, flushQueuedProfilesBatch }, userIds);
    },
    [flushQueuedProfilesBatch, readProfileFromCache],
  );

  const openConversation = useCallback(async (link: string, options?: {
    force?: boolean;
    revalidate?: boolean;
    chatType?: ConversationChatType

  }) => {
    return openConversationAction({ chats, selectedSearchTargetRef, openConversationInFlightRef, conversationRequestSeqRef, selectedLinkRef, activeConversationRef, setActiveConversation, setMessages, setHasMoreMessagesBefore, setDecryptingConversation, setInspectedDetailsEntity, setLoadingConversation, t, currentUserIdRef, selfId, setSecretChatExpiresAt, ensureOwnE2EReady: deferred.history.ensureOwnE2EReady, decryptMessageWithRecovery: deferred.history.decryptMessageWithRecovery, cryptoDiagnosticRef, unreadByLink, sanitizeMessages, ensureProfilesBatch, sendReadReceipt, setErrorText, isDesktop, setSelectedLink, router, setChats, setReadReceiptMarker, mergeProfilesToCache, peerPublicKeyByLinkRef, messagesRef: deferred.reactions.realtimeHandler.messagesRef, buildSharedChatKeyId: deferred.history.buildSharedChatKeyId, loadSharedKeyByVersion: deferred.history.loadSharedKeyByVersion, ensureSharedKeyFromServer: deferred.history.ensureSharedKeyFromServer, privateKeyRef, suppressRequestedChatSyncRef, setProfileData, setDesktopDetailsPanelOpen, setProfileModalOpen }, link, options);
  }, [chats, ensureProfilesBatch, isDesktop, mergeProfilesToCache, privateKey, sanitizeMessages, selfId, t]);

  openConversationRef.current = openConversation;

  return {
    activeGroupModalSeed,
    activeChannelModalSeed,
    accountNavigation: accountNavigationStateModel,
    ensureSharedKeyFromServerRef,
    prewarmSharedKeysForChatPreviews,
    loadSecretChatsRef,
    loadChatPage,
    readProfileFromCache,
    ensureProfilesBatch
  };
}
