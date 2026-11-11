"use client";

import { useBotChatSettings } from "../../components/common/BotChatControls";

import { useEffect, useMemo } from "react";

import { useEclipseBotManagement } from "../../components/common/EclipseBotMenu";
import { ECLIPSE_DIALOG_LINK } from "@/lib/eclipse-system";

import { readForwardedContent } from "@/lib/client/message-forwarding";

import { type DecryptedMessage, type GroupMember, type ConversationCacheSnapshot, type ActivityIndicatorKind } from "../../types";

import { compareMessagesByTime, mergeMessageWindow } from "../../chat-message-state";

import { readConversationMemoryCache, loadConversationSessionCache, loadConversationPersistentCache, stableReadViewerScore } from "../chat-cache";
import { parseMessageContentCached, canEditMessageContent, canEditMessage } from "../message-content";

import { isWelcomeStickerSrc, formatMessageTimeLabel, getReplyPreviewText } from "../message-presentation";

import { activeStatusTextAction } from "../conversation-selectors";

import type { ConversationNavigationModel } from "./useConversationNavigation";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatPagePresentationModel } from "./useChatPagePresentation";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ConversationPresentationSources {
  navigation: Pick<ConversationNavigationModel, "isFileDrag">;
  page: Pick<ChatPageStateModel, "t" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs"> & {
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "setDragActive" | "pickedFilesProcessingRef">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "selectedLinkRef">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "setMessages" | "setChats" | "messages">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "typingByLink" | "recordingByLink" | "sendingByLink">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "loadingConversation">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop" | "inspectedDetailsEntity">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "setSecretChatExpiresAt">;
    appearance: Pick<ChatPageStateModel["appearance"], "messageHelperId">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "editTarget" | "replyToMessageId">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalData">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "selectedMessageIds">;

  };
  callbacks: Pick<ChatPageCallbacks, "processPickedFiles">;
  active: Pick<ActiveConversationModel, "activeChat">;
  bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache" | "ensureProfilesBatch">;
  elements: Pick<ChatElementStateModel, "scrollMessagesToBottom"> & {
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "messagesAtBottomRef">;

  };
}

export interface ConversationPresentationDeferred {
  readonly view: Pick<ChatPagePresentationModel, "canDropChatFiles">;
}
export interface ConversationPresentationModel {
  handleDrop: (e: React.DragEvent<Element>) => Promise<void>;
  activeTitle: string;
  activePeerId: string | null;
  groupMembersById: Map<string, import("@/app/app/(chats)/types").GroupMember>;
  isSecretChat: boolean;
  isSavedConversation: boolean;
  isEclipseConversation: boolean;
  isManagedBotConversation: boolean;
  botChatUi: ReturnType<typeof useBotChatSettings>;
  eclipseBots: ReturnType<typeof useEclipseBotManagement>;
  isSecretChatCreator: boolean;
  isSecretChatComposerBlocked: boolean;
  isSecretChatAcceptRequired: boolean;
  activeStatusClass: "text-white/90" | "text-zinc-500";
  activeStatusIndicatorKind: import("@/app/app/(chats)/types").ActivityIndicatorKind | null;
  mobileChatOpen: boolean;
  hasSentWelcomeSticker: boolean;
  activeStatusText: string;
  activeDetailsChatType: import("@/app/app/(chats)/types").ConversationChatType | null;
  effectiveDetailsChatType: import("@/app/app/(chats)/types").ConversationChatType | null;
  canUseDesktopDetailsPanel: boolean;
  showDirectEmptyState: boolean;
  helperMessage: import("@/app/app/(chats)/types").DecryptedMessage | null;
  helperParsed: import("@/app/app/(chats)/types").ParsedMessageContent | null;
  helperIsMine: boolean;
  helperEditTargetId: string | null;
  helperIsEditable: boolean;
  shouldUseLegacyMessageHelper: false;
  helperCanDelete: boolean;
  helperShowDeliveryStatus: boolean;
  helperPendingLabel: string | null;
  helperShowChannelViews: boolean;
  helperChannelViewsText: string;
  helperTimeText: string;
  helperReadViewers: import("@/app/app/(chats)/types").MessageReadViewer[];
  helperReadPreviewViewers: import("@/app/app/(chats)/types").MessageReadViewer[];
  helperCopyValue: string;
  helperCanCopy: boolean;
  selectedMessageIdSet: Set<string>;
  selectedMessages: import("@/app/app/(chats)/types").DecryptedMessage[];
  replyMessageById: Map<string, import("@/app/app/(chats)/types").DecryptedMessage>;
  replyTargetMessage: import("@/app/app/(chats)/types").DecryptedMessage | null;
  helperReplyMessage: import("@/app/app/(chats)/types").DecryptedMessage | null;
  helperReplyAuthor: string;
  helperReplyPreviewText: string;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useConversationPresentation(sources: ConversationPresentationSources, deferred: ConversationPresentationDeferred): ConversationPresentationModel {
  const { isFileDrag } = sources.navigation;
  const { t, onlineUserIds, lastOfflineAtByUserId, presenceNowTs } = sources.page;
  const { setDragActive, pickedFilesProcessingRef } = sources.page.wallpaperUpload;
  const { selectedLink, selectedLinkRef } = sources.page.selection;
  const { activeConversation, setMessages, setChats, messages } = sources.page.conversation;
  const { selfId, selfProfile } = sources.page.account;
  const { typingByLink, recordingByLink, sendingByLink } = sources.page.recorderPresentation;
  const { loadingConversation } = sources.page.conversationRequest;
  const { isDesktop, inspectedDetailsEntity } = sources.page.panels;
  const { setSecretChatExpiresAt } = sources.page.secretChatDraft;
  const { messageHelperId } = sources.page.appearance;
  const { editTarget, replyToMessageId } = sources.page.composerInteraction;
  const { channelModalData } = sources.page.mediaAndChannel;
  const { selectedMessageIds } = sources.page.messageInteraction;
  const { processPickedFiles } = sources.callbacks;
  const { activeChat } = sources.active;
  const { readProfileFromCache, ensureProfilesBatch } = sources.bootstrap;
  const { scrollMessagesToBottom } = sources.elements;
  const { messagesAtBottomRef } = sources.elements.conversationScroll;

  const handleDrop = async (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragActive(false);
    if (!deferred.view.canDropChatFiles || pickedFilesProcessingRef.current) return;
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    pickedFilesProcessingRef.current = true;
    try { await processPickedFiles(files); }
    finally { pickedFilesProcessingRef.current = false; }
  };

  const activeTitle = useMemo(() => {
    if (activeChat?.contactAlias?.trim()) return activeChat.contactAlias.trim();
    const isSec = Boolean(selectedLink?.startsWith("secret-"));
    if (isSec) {
      if (activeConversation?.peer?.displayName) {
        return activeConversation.peer.displayName;
      }
      if (activeChat?.displayName) {
        return activeChat.displayName;
      }
      return t("Секретный чат");
    }

    if (activeConversation?.chatType === "eclipse" && activeConversation.eclipse?.title) {
      return activeConversation.eclipse.title;
    }
    if (activeConversation?.chatType === "saved" && activeConversation.saved?.title) {
      return t("Избранное");
    }
    if (activeConversation?.chatType === "group" && activeConversation.group?.name) {
      return activeConversation.group.name;
    }
    if (activeConversation?.chatType === "channel" && activeConversation.channel?.name) {
      return activeConversation.channel.name;
    }
    if (activeConversation?.peer?.displayName) {
      return activeConversation.peer.displayName;
    }

    return activeChat?.chatType === "saved" ? t("Избранное") : activeChat?.displayName ?? "";
  }, [activeConversation, activeChat, t]);

  const activePeerId = activeConversation?.chatType === "direct" ? activeConversation.peer?.id ?? activeChat?.peerId ?? null : null;

  const activePeerProfile = activePeerId ? readProfileFromCache(activePeerId) : null;

  const activePeerCanDisplayPresence =
    activePeerId === selfId || (activePeerId ? activePeerProfile?.presenceVisibility !== "none" : true);

  const activePeerCanDisplayLastSeen =
    activePeerId === selfId || (activePeerId ? activePeerProfile?.lastSeenVisibility !== "none" : true);

  useEffect(() => {
    if (!activePeerId || activePeerId === selfId) return;
    void ensureProfilesBatch([activePeerId]);
  }, [activePeerId, ensureProfilesBatch, selfId]);

  const activeTypingMembers = useMemo(() => {
    if (!activeChat?.link) return [];
    return Object.values(typingByLink[activeChat.link] ?? {});
  }, [activeChat?.link, typingByLink]);

  const activeRecordingMembers = useMemo(() => {
    if (!activeChat?.link) return [];
    return Object.values(recordingByLink[activeChat.link] ?? {});
  }, [activeChat?.link, recordingByLink]);

  const activeSendingMembers = useMemo(() => {
    if (!activeChat?.link) return [];
    return Object.values(sendingByLink[activeChat.link] ?? {});
  }, [activeChat?.link, sendingByLink]);

  const groupMembersById = useMemo(() => {
    const map = new Map<string, GroupMember>();
    (activeConversation?.members ?? []).forEach((member) => {
      map.set(member.id, member);
    });
    return map;
  }, [activeConversation?.members]);

  const isSecretChat = Boolean(selectedLink?.startsWith("secret-"));

  const isSavedConversation = Boolean(
    activeConversation?.chatType === "saved" ||
    activeChat?.chatType === "saved" ||
    selectedLink === "saved" ||
    activeChat?.link === "saved"
  );

  const isEclipseConversation = Boolean(
    activeConversation?.chatType === "eclipse" ||
    activeChat?.chatType === "eclipse" ||
    selectedLink === ECLIPSE_DIALOG_LINK ||
    activeChat?.link === ECLIPSE_DIALOG_LINK
  );

  const isManagedBotConversation = !isEclipseConversation && !selectedLink?.startsWith("secret-") && Boolean(
    activeChat?.isBot || (activeConversation?.chatType === "direct" && activeConversation.peer?.isBot)
  );

  const botChatUi = useBotChatSettings({
    enabled: isManagedBotConversation,
    link: selectedLink,
    chatId: activeConversation?.chatType === "direct" && activeConversation.peer?.link === selectedLink ? activeConversation.conversationId : null,
    userId: selfId,
  });

  const eclipseBots = useEclipseBotManagement({
    enabled: isEclipseConversation,
    ownerId: selfId ?? selfProfile?.id ?? null,
    onMessages: incoming => {
      if (selectedLinkRef.current !== ECLIPSE_DIALOG_LINK) return;
      messagesAtBottomRef.current = true;
      setMessages(previous => mergeMessageWindow(previous, incoming.map(message => ({
        id: message.id, senderId: message.senderId,
        text: message.systemPayload.botRole === "user" ? message.systemPayload.body : message.systemPayload.title,
        systemPayload: message.systemPayload, createdAt: message.createdAt, reactions: [],
      }))).sort(compareMessagesByTime));
      const latest = incoming.at(-1);
      if (latest) setChats(previous => previous.map(chat => chat.link === ECLIPSE_DIALOG_LINK ? {
        ...chat,
        lastMessage: latest.systemPayload.botRole === "user" ? latest.systemPayload.body : latest.systemPayload.title,
        lastMessageAt: latest.createdAt,
      } : chat));
      requestAnimationFrame(() => scrollMessagesToBottom("smooth"));
    },
  });

  const isGroupConversation = Boolean(
    activeConversation?.chatType === "group" ||
    activeChat?.chatType === "group"
  );

  const isChannelConversation = Boolean(
    activeConversation?.chatType === "channel" ||
    activeChat?.chatType === "channel"
  );

  const isDirectConversation = !isSavedConversation && !isEclipseConversation && !isGroupConversation && !isChannelConversation && !isSecretChat;

  const isSecretChatApproved = Boolean(
    isSecretChat && (activeConversation?.isApproved ?? activeChat?.isApproved ?? false)
  );

  const isSecretChatCreator = Boolean(
    isSecretChat && (
      activeConversation?.isCreator ??
      activeChat?.isCreator ??
      (activeConversation?.creatorId && selfId ? activeConversation.creatorId === selfId : (activeChat?.creatorId && selfId ? activeChat.creatorId === selfId : false))
    )
  );

  const isSecretChatComposerBlocked = isSecretChat && !isSecretChatApproved && isSecretChatCreator;

  const isSecretChatAcceptRequired = isSecretChat && !isSecretChatApproved && !isSecretChatCreator && !loadingConversation;

  const activeGroupOnlineCount = useMemo(() => {
    if (!isGroupConversation) return 0;
    const members = activeConversation?.members ?? [];
    return members.filter((member) => {
      if (member.id === selfId) return false;
      if (!onlineUserIds.has(member.id)) return false;
      return true;
    }).length;
  }, [isGroupConversation, activeConversation?.members, onlineUserIds, readProfileFromCache, selfId]);

  const activeIsTyping = activeTypingMembers.length > 0;

  const activeIsRecording = activeRecordingMembers.length > 0;

  const activeIsSending = activeSendingMembers.length > 0;

  const activeSendingStatusText =
    activeSendingMembers.length <= 1
      ? activeSendingMembers[0] ?? ""
      : t("отправляет файлы");

  const activeRecordingStatusText =
    activeRecordingMembers.length <= 1
      ? activeRecordingMembers[0] ?? ""
      : t("несколько участников записывают");

  const activeGroupTypingText =
    activeTypingMembers.length === 1
      ? t("{0} печатает", { 0: activeTypingMembers[0] })
      : activeTypingMembers.length === 2
        ? t("{0} и {1} печатают", { 0: activeTypingMembers[0], 1: activeTypingMembers[1] })
        : activeTypingMembers.length > 2
          ? t("{0} человека печатают", { 0: activeTypingMembers.length })
          : "";

  const activeStatusClass =
    activeIsSending || activeIsRecording || activeIsTyping
      ? "text-white/90"
      : "text-zinc-500";

  const activeStatusIndicatorKind: ActivityIndicatorKind | null =
    activeIsSending || activeIsRecording
      ? "pulse"
      : activeIsTyping
        ? "typing"
        : null;

  const mobileChatOpen = !isDesktop && Boolean(activeChat);

  const isConversationEmpty = !loadingConversation && messages.length === 0;

  const hasSentWelcomeSticker = useMemo(
    () =>
      messages.some((message) => {
        if (message.senderId !== selfId) return false;
        const parsed = parseMessageContentCached(message.text, false);
        return parsed.kind === "sticker" && isWelcomeStickerSrc(parsed.src);
      }),
    [messages, selfId],
  );

  const activeStatusText = useMemo(() => {
    return activeStatusTextAction({ isSavedConversation, t, isEclipseConversation, isSecretChat, isSecretChatApproved, isSecretChatCreator, activeTitle, activeIsSending, activeSendingStatusText, activeIsRecording, activeRecordingStatusText, activeIsTyping, activePeerId, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, activePeerCanDisplayPresence, activePeerCanDisplayLastSeen, isGroupConversation, activeTypingMembers, activeGroupTypingText, activeConversation, activeChat, activeGroupOnlineCount, isChannelConversation });
  }, [
    activeChat,
    activeConversation,
    activeGroupOnlineCount,
    activeGroupTypingText,
    activeIsRecording,
    activeIsSending,
    activeIsTyping,
    activePeerCanDisplayLastSeen,
    activePeerCanDisplayPresence,
    activePeerId,
    activeRecordingStatusText,
    activeSendingStatusText,
    activeTitle,
    activeTypingMembers.length,
    isChannelConversation,
    isEclipseConversation,
    isGroupConversation,
    isSavedConversation,
    isSecretChat,
    isSecretChatApproved,
    isSecretChatCreator,
    lastOfflineAtByUserId,
    onlineUserIds,
    presenceNowTs, t]);

  useEffect(() => {
    if (!isSecretChat || !activeConversation) {
      // Not a secret chat — clear any stale expiresAt
      setSecretChatExpiresAt(null);
      return;
    }
    if (activeConversation.expiresAt) {
      setSecretChatExpiresAt(activeConversation.expiresAt);
    }
  }, [isSecretChat, activeConversation]);

  const activeDetailsChatType = activeChat?.chatType ?? activeConversation?.chatType ?? null;

  const effectiveDetailsChatType = inspectedDetailsEntity?.type ?? activeDetailsChatType;

  const canUseDesktopDetailsPanel =
    isDesktop &&
    (Boolean(inspectedDetailsEntity) ||
      (Boolean(activeChat) &&
        (activeDetailsChatType === "direct" || activeDetailsChatType === "group" || activeDetailsChatType === "channel")));

  const showDirectEmptyState = isConversationEmpty && (isDirectConversation || isSavedConversation);

  const helperMessage = useMemo(
    () => (messageHelperId ? messages.find((item) => item.id === messageHelperId) ?? null : null),
    [messageHelperId, messages],
  );

  const helperParsed = useMemo(
    () => (helperMessage ? parseMessageContentCached(helperMessage.text) : null),
    [helperMessage],
  );

  const rawHelperIsMine = helperMessage ? helperMessage.senderId === selfId : false;

  const helperIsChannelChat = activeConversation?.chatType === "channel";

  const helperIsMine = helperIsChannelChat ? false : rawHelperIsMine;

  const helperEditTargetId = editTarget?.id ?? null;

  const helperCanModerateGroupMessages =
    activeConversation?.chatType === "group" &&
    (activeConversation.group?.myRole === "owner" || activeConversation.group?.myRole === "admin");

  const helperCanModerateChannelMessages =
    helperIsChannelChat &&
    Boolean(
      (activeConversation?.channel && selfId && activeConversation.channel.ownerId === selfId) ||
      channelModalData?.channel?.isOwner ||
      channelModalData?.channel?.myCanManageAdmins
    );

  const helperIsEditable =
    helperMessage && helperParsed && !readForwardedContent(helperMessage.text)
      ? helperIsChannelChat
        ? (rawHelperIsMine || helperCanModerateChannelMessages) && canEditMessageContent(helperParsed)
        : canEditMessage(helperMessage, helperParsed, rawHelperIsMine)
      : false;

  const shouldUseLegacyMessageHelper = false;

  const helperCanDelete = helperMessage
    ? activeConversation?.chatType === "group"
      ? rawHelperIsMine || helperCanModerateGroupMessages
      : helperIsChannelChat
        ? rawHelperIsMine || helperCanModerateChannelMessages
        : true
    : false;

  const helperShowDeliveryStatus = Boolean(
    helperIsMine && (activeConversation?.chatType === "direct" || activeConversation?.chatType === "group"),
  );

  const helperPendingLabel = helperMessage?.pending ? t("Отправка") : null;

  const helperShowChannelViews = activeConversation?.chatType === "channel";

  const helperChannelViewsValue = Number(helperMessage?.viewsCount ?? 0);

  const helperChannelViewsText = helperShowChannelViews
    ? `${Math.max(1, Number.isFinite(helperChannelViewsValue) ? helperChannelViewsValue : 0)}`
    : `${helperMessage?.viewsCount ?? "0"}`;

  const helperTimeText = helperMessage ? formatMessageTimeLabel(helperMessage.createdAt) : "";

  const helperReadViewers = useMemo(
    () =>
      activeConversation?.chatType === "group" && helperIsMine
        ? (helperMessage?.readBy ?? []).filter((viewer) => viewer.id !== helperMessage?.senderId)
        : [],
    [activeConversation?.chatType, helperIsMine, helperMessage],
  );

  const helperReadPreviewViewers = useMemo(() => {
    if (helperReadViewers.length <= 3) return helperReadViewers;
    return helperReadViewers
      .map((viewer) => ({ viewer, score: stableReadViewerScore(helperMessage?.id ?? "", viewer.id) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((entry) => entry.viewer);
  }, [helperMessage?.id, helperReadViewers]);

  const helperCopyValue = useMemo(() => {
    if (!helperParsed) return "";
    return helperParsed.kind === "image"
      ? helperParsed.caption
      : helperParsed.kind === "poll"
        ? helperParsed.question
        : helperParsed.kind === "album"
          ? helperParsed.caption
          : helperParsed.kind === "sticker"
            ? ""
            : helperParsed.kind === "voice" || helperParsed.kind === "video"
              ? ""
              : helperParsed.kind === "file"
                ? (helperParsed.caption || helperParsed.name)
                : helperParsed.kind === "music"
                  ? (helperParsed.caption || helperParsed.title)
                  : helperParsed.text;
  }, [helperParsed]);

  const helperCanCopy = helperCopyValue.trim().length > 0;

  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  const selectedMessageIdSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds]);

  const selectedMessages = useMemo(
    () => selectedMessageIds.map((messageId) => messageById.get(messageId)).filter(Boolean) as DecryptedMessage[],
    [messageById, selectedMessageIds],
  );

  const replyMessageById = useMemo(() => {
    const map = new Map(messageById);
    if (!selfId || !selectedLink) {
      return map;
    }
    const activeChatType = activeConversation?.chatType;
    if (!activeChatType) {
      return map;
    }
    const snapshots: Array<ConversationCacheSnapshot | null> = [
      readConversationMemoryCache(selfId, selectedLink, activeChatType),
      loadConversationSessionCache(selfId, selectedLink, activeChatType),
      loadConversationPersistentCache(selfId, selectedLink, activeChatType),
    ];
    for (const snapshot of snapshots) {
      if (!snapshot || !Array.isArray(snapshot.messages) || snapshot.messages.length === 0) continue;
      for (const cachedMessage of snapshot.messages) {
        if (!cachedMessage?.id || map.has(cachedMessage.id)) continue;
        map.set(cachedMessage.id, cachedMessage);
      }
    }
    return map;
  }, [activeConversation?.chatType, messageById, selectedLink, selfId]);

  const replyTargetMessage = useMemo(
    () => (replyToMessageId ? replyMessageById.get(replyToMessageId) ?? null : null),
    [replyMessageById, replyToMessageId],
  );

  const helperReplyMessage = useMemo(
    () => (helperMessage?.replyToMessageId ? replyMessageById.get(helperMessage.replyToMessageId) ?? null : null),
    [helperMessage, replyMessageById],
  );

  const helperReplyProfile = helperReplyMessage ? readProfileFromCache(helperReplyMessage.senderId) : null;

  const helperReplyAuthor =
    helperReplyMessage
      ? activeConversation?.chatType === "channel"
        ? activeTitle || activeChat?.displayName || t("Канал")
        : helperReplyMessage.senderId === selfId
          ? selfProfile?.displayName || selfProfile?.link || t("Я")
          : helperReplyMessage.senderDisplayName ||
          helperReplyProfile?.displayName ||
          (activeConversation?.chatType === "direct" ? activeTitle || t("Собеседник") : t("Собеседник"))
      : "";

  const helperReplyPreviewText = helperReplyMessage ? getReplyPreviewText(helperReplyMessage.text) : "";

  return {
    handleDrop,
    activeTitle,
    activePeerId,
    groupMembersById,
    isSecretChat,
    isSavedConversation,
    isEclipseConversation,
    isManagedBotConversation,
    botChatUi,
    eclipseBots,
    isSecretChatCreator,
    isSecretChatComposerBlocked,
    isSecretChatAcceptRequired,
    activeStatusClass,
    activeStatusIndicatorKind,
    mobileChatOpen,
    hasSentWelcomeSticker,
    activeStatusText,
    activeDetailsChatType,
    effectiveDetailsChatType,
    canUseDesktopDetailsPanel,
    showDirectEmptyState,
    helperMessage,
    helperParsed,
    helperIsMine,
    helperEditTargetId,
    helperIsEditable,
    shouldUseLegacyMessageHelper,
    helperCanDelete,
    helperShowDeliveryStatus,
    helperPendingLabel,
    helperShowChannelViews,
    helperChannelViewsText,
    helperTimeText,
    helperReadViewers,
    helperReadPreviewViewers,
    helperCopyValue,
    helperCanCopy,
    selectedMessageIdSet,
    selectedMessages,
    replyMessageById,
    replyTargetMessage,
    helperReplyMessage,
    helperReplyAuthor,
    helperReplyPreviewText
  };
}
