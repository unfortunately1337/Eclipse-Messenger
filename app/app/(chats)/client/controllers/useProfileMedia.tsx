"use client";

import { schedulePanelIdle } from "@/lib/client/panel-work";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getPresenceStatusText } from "@/lib/client/presence-status";

import { resolveMessageMedia } from "@/lib/client/media-crypto";
import { getCachedMediaUrl } from "@/lib/client/media-cache";
import { type ChatSummary, type ChatImageGalleryItem } from "../../types";

import { parseMessageContentCached } from "../message-content";

import { formatMessageTimeLabel, getReplyPreviewText } from "../message-presentation";

import { formatMediaViewerDate } from "../media-recording";

import { chatSharedMediaListAction, chatSharedVoiceListAction, chatImageGalleryAction } from "../conversation-selectors";
import { handleVideoViewerAuthorClickAction, handleImageViewerAuthorClickAction, resolveUnreadCountAction } from "../chat-list-selectors";

import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ProfileMediaSources {
  presentation: Pick<ConversationPresentationModel, "replyTargetMessage" | "activeTitle" | "groupMembersById" | "activePeerId" | "isSecretChat" | "activeStatusText">;
  page: Pick<ChatPageStateModel, "t" | "profileModalOpen" | "reducedPanelMotion" | "profileData" | "profileIsSaved" | "profileIsBot" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "messages" | "chats">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyReplyTarget">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "sending" | "sendingMedia">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "forwardSending" | "forwardDraft" | "unreadByLink" | "readMarkersRef" | "readMarkersVersion">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "editTarget">;
    selection: Pick<ChatPageStateModel["selection"], "messageText" | "selectedLink">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "pendingMediaBatch" | "pendingImage" | "pendingVideo" | "pendingAudio" | "pendingFile">;
    panels: Pick<ChatPageStateModel["panels"], "desktopDetailsPanelOpen">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "groupModalOpen">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalOpen" | "contactsForAdd" | "setImageViewer" | "setImageViewerIndex" | "setImageViewerPanelVisible" | "setImageViewerMenuOpen" | "imageViewerIndex" | "imageViewer" | "setImageViewerDirection" | "imageViewerTouchRef" | "videoViewer" | "setVideoViewer" | "setVideoViewerFailed" | "setVideoViewerPlaying" | "setVideoViewerProgress" | "setVideoViewerCurrentTime" | "setVideoViewerMenuOpen">;
    userDetails: Pick<ChatPageStateModel["userDetails"], "profileActiveTab">;

  };
  active: Pick<ActiveConversationModel, "activeChat" | "isDirectChatActive">;
  bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
  callbacks: Pick<ChatPageCallbacks, "isEditDraftValid" | "openChannelModal" | "openProfileModal">;
  elements: {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "videoViewerRef">;

  };
}

export interface ProfileMediaModel {
  replyComposerAuthor: string;
  canSubmitMessage: boolean;
  profileMediaVisible: boolean;
  chatSharedMediaList: {
    id: string;
    messageId: string;
    kind: "image" | "video";
    src: string;
    caption?: string | undefined;
    durationMs?: number | undefined;
    mode?: "file" | "note" | undefined;
    timeText: string;
    dateText: string;
    authorName: string;
    authorAvatarUrl: string | null;
    authorLink: string | null;
    canDelete: boolean;
    isMine: boolean;

  }[];
  chatSharedFilesList: {
    id: string;
    messageId: string;
    name: string;
    size?: number | undefined;
    src: string;
    dateText: string;
    timeText: string;
    extension: string;

  }[];
  chatSharedVoiceList: {
    id: string;
    messageId: string;
    src: string;
    durationMs?: number | undefined;
    dateText: string;
    timeText: string;
    authorName: string;
    authorAvatarUrl: string | null;
    isMine: boolean;

  }[];
  chatSharedMusicList: {
    id: string;
    messageId: string;
    url: string;
    title: string;
    author: string;
    coverUrl?: string | null | undefined;
    durationMs?: number | undefined;
    dateText: string;
    timeText: string;

  }[];
  chatSharedLinksList: {
    id: string;
    messageId: string;
    url: string;
    domain: string;
    snippet: string;
    dateText: string;
    timeText: string;

  }[];
  profileHeaderStatusText: string;
  chatImageGallery: import("@/app/app/(chats)/types").ChatImageGalleryItem[];
  openImageViewer: (item: import("@/app/app/(chats)/types").ChatImageGalleryItem) => void;
  stepImageViewer: (direction: 1 | -1) => void;
  handleImageViewerTouchStart: (e: React.TouchEvent<Element>) => void;
  handleImageViewerTouchEnd: (e: React.TouchEvent<Element>) => void;
  handleVideoViewerAuthorClick: () => void;
  handleImageViewerAuthorClick: () => void;
  chatUnreadCountByLink: Map<string, number>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useProfileMedia(sources: ProfileMediaSources): ProfileMediaModel {
  const { replyTargetMessage, activeTitle, groupMembersById, activePeerId, isSecretChat, activeStatusText } = sources.presentation;
  const { t, profileModalOpen, reducedPanelMotion, profileData, profileIsSaved, profileIsBot, onlineUserIds, lastOfflineAtByUserId, presenceNowTs } = sources.page;
  const { activeConversation, messages, chats } = sources.page.conversation;
  const { selfId, selfProfile } = sources.page.account;
  const { storyReplyTarget } = sources.page.storyDraft;
  const { sending, sendingMedia } = sources.page.conversationRequest;
  const { forwardSending, forwardDraft, unreadByLink, readMarkersRef, readMarkersVersion } = sources.page.messageInteraction;
  const { editTarget } = sources.page.composerInteraction;
  const { messageText, selectedLink } = sources.page.selection;
  const { pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile } = sources.page.attachmentDraft;
  const { desktopDetailsPanelOpen } = sources.page.panels;
  const { groupModalOpen } = sources.page.groupDetails;
  const { channelModalOpen, contactsForAdd, setImageViewer, setImageViewerIndex, setImageViewerPanelVisible, setImageViewerMenuOpen, imageViewerIndex, imageViewer, setImageViewerDirection, imageViewerTouchRef, videoViewer, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying, setVideoViewerProgress, setVideoViewerCurrentTime, setVideoViewerMenuOpen } = sources.page.mediaAndChannel;
  const { profileActiveTab } = sources.page.userDetails;
  const { activeChat, isDirectChatActive } = sources.active;
  const { readProfileFromCache } = sources.bootstrap;
  const { isEditDraftValid, openChannelModal, openProfileModal } = sources.callbacks;
  const { videoViewerRef } = sources.elements.conversationElement;

  const replyComposerAuthor = useMemo(() => {
    if (!replyTargetMessage) return "";
    if (activeConversation?.chatType === "channel") return activeTitle || activeChat?.displayName || t("Канал");
    if (replyTargetMessage.senderId === selfId) return selfProfile?.displayName || selfProfile?.link || t("Я");
    const profile = readProfileFromCache(replyTargetMessage.senderId);
    return replyTargetMessage.senderDisplayName || profile?.displayName || activeTitle || t("Собеседник");
  }, [activeChat?.displayName, activeConversation?.chatType, activeTitle, readProfileFromCache, replyTargetMessage, selfId, selfProfile?.displayName, selfProfile?.link, t]);

  const replyComposerPreview = useMemo(
    () => (replyTargetMessage ? getReplyPreviewText(replyTargetMessage.text) : ""),
    [replyTargetMessage],
  );

  const storyReplyComposerPreview = useMemo(() => storyReplyTarget?.previewText ?? "", [storyReplyTarget]);

  const canSubmitMessage = useMemo(() => {
    if (sending || sendingMedia || forwardSending) return false;
    if (editTarget) {
      return isEditDraftValid(editTarget, messageText);
    }
    return Boolean(forwardDraft?.messages.length || messageText.trim() || pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile);
  }, [editTarget, forwardDraft, forwardSending, messageText, pendingAudio, pendingFile, pendingImage, pendingMediaBatch, pendingVideo, sending, sendingMedia]);

  const detailsPanelOpen = desktopDetailsPanelOpen || profileModalOpen || groupModalOpen || channelModalOpen;

  const [detailsTabsReady, setDetailsTabsReady] = useState(false);

  useEffect(() => {
    if (!detailsPanelOpen) {
      setDetailsTabsReady(false);
      return;
    }
    return schedulePanelIdle(() => setDetailsTabsReady(true), reducedPanelMotion ? 0 : undefined);
  }, [detailsPanelOpen, reducedPanelMotion]);

  const profileMediaVisible = detailsPanelOpen && detailsTabsReady;

  const chatSharedMediaList = useMemo(() => {
    return chatSharedMediaListAction({ profileMediaVisible, profileActiveTab, selfId, selfProfile, messages, activeConversation, groupMembersById, readProfileFromCache, contactsForAdd, activeChat, selectedLink, activeTitle, t });
  }, [
    profileMediaVisible,
    profileActiveTab,
    activeChat?.avatarUrl,
    activeChat?.displayName,
    activeChat?.peerId,
    activeConversation?.chatType,
    activeConversation?.peer?.displayName,
    activeConversation?.peer?.id,
    activeConversation?.peer?.link,
    activeTitle,
    contactsForAdd,
    groupMembersById,
    messages,
    readProfileFromCache,
    selectedLink,
    selfId,
    selfProfile?.avatarUrl,
    selfProfile?.displayName,
    selfProfile?.id, t]);

  const chatSharedFilesList = useMemo(() => {
    if (!profileMediaVisible || profileActiveTab !== "files") return [];
    const list: Array<{

      id: string;

      messageId: string;

      name: string;

      size?: number;

      src: string;

      dateText: string;

      timeText: string;

      extension: string;

    }> = [];

    for (const message of messages) {
      const raw = parseMessageContentCached(message.text, false);
      if (!["file"].includes(raw.kind)) continue;
      const parsed = resolveMessageMedia(raw);
      if (parsed.kind === "file" && (parsed.src || (parsed as any).url)) {
        const fileUrl = parsed.src || (parsed as any).url || "";
        const fileName = parsed.name || t("Файл");
        const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "file" : "file";
        list.push({
          id: `${message.id}-file`,
          messageId: message.id,
          name: fileName,
          size: parsed.size,
          src: fileUrl,
          dateText: formatMediaViewerDate(message.createdAt),
          timeText: formatMessageTimeLabel(message.createdAt),
          extension: ext,
        });
      }
    }
    return list;
  }, [messages, profileMediaVisible, profileActiveTab, t]);

  const chatSharedVoiceList = useMemo(() => {
    return chatSharedVoiceListAction({ profileMediaVisible, profileActiveTab, selfId, selfProfile, messages, activeConversation, readProfileFromCache, contactsForAdd, activeChat, selectedLink, activeTitle, t });
  }, [
    profileMediaVisible,
    profileActiveTab,
    activeChat?.avatarUrl,
    activeChat?.displayName,
    activeChat?.peerId,
    activeConversation?.chatType,
    activeConversation?.peer?.displayName,
    activeConversation?.peer?.id,
    activeConversation?.peer?.link,
    activeTitle,
    contactsForAdd,
    messages,
    readProfileFromCache,
    selectedLink,
    selfId,
    selfProfile?.avatarUrl,
    selfProfile?.id, t]);

  const chatSharedMusicList = useMemo(() => {
    if (!profileMediaVisible || profileActiveTab !== "music") return [];
    const list: Array<{

      id: string;

      messageId: string;

      url: string;

      title: string;

      author: string;

      coverUrl?: string | null;

      durationMs?: number;

      dateText: string;

      timeText: string;

    }> = [];

    for (const message of messages) {
      const raw = parseMessageContentCached(message.text, false);
      if (!["music"].includes(raw.kind)) continue;
      const parsed = resolveMessageMedia(raw);
      if (parsed.kind === "music" && parsed.url) {
        list.push({
          id: `${message.id}-music`,
          messageId: message.id,
          url: parsed.url,
          title: parsed.title || t("Музыка"),
          author: parsed.author || t("Аудиозапись"),
          coverUrl: parsed.coverUrl,
          durationMs: parsed.durationMs,
          dateText: formatMediaViewerDate(message.createdAt),
          timeText: formatMessageTimeLabel(message.createdAt),
        });
      }
    }
    return list;
  }, [messages, profileMediaVisible, profileActiveTab, t]);

  const chatSharedLinksList = useMemo(() => {
    const list: Array<{

      id: string;

      messageId: string;

      url: string;

      domain: string;

      snippet: string;

      dateText: string;

      timeText: string;

    }> = [];

    const urlRegex = /https?:\/\/[^\s]+/gi;
    for (const message of messages) {
      const text = message.text || "";
      const matches = text.match(urlRegex);
      if (matches && matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const rawUrl = matches[i];
          let domain = rawUrl.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
          const cleanSnippet = text.replace(rawUrl, "").trim();
          list.push({
            id: `${message.id}-link-${i}`,
            messageId: message.id,
            url: rawUrl,
            domain,
            snippet: cleanSnippet,
            dateText: formatMediaViewerDate(message.createdAt),
            timeText: formatMessageTimeLabel(message.createdAt),
          });
        }
      }
    }
    return list;
  }, [messages]);

  const profileHeaderStatusText = useMemo(() => {
    if (!profileData) return "";
    if (profileIsSaved) return t("ваше облачное хранилище");
    if (profileIsBot) return t("бот");
    if (profileData.id === activePeerId && (isDirectChatActive || isSecretChat)) return activeStatusText;
    return t(getPresenceStatusText(profileData.id, onlineUserIds, lastOfflineAtByUserId, presenceNowTs,
      profileData.id === selfId || profileData.presenceVisibility !== "none",
      profileData.id === selfId || profileData.lastSeenVisibility !== "none"));
  }, [profileData, profileIsSaved, profileIsBot, activePeerId, isDirectChatActive, isSecretChat, activeStatusText, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, t]);

  const chatImageGallery = useMemo<ChatImageGalleryItem[]>(() => {
    return chatImageGalleryAction({ selfId, selfProfile, messages, activeConversation, groupMembersById, readProfileFromCache, contactsForAdd, activeChat, selectedLink, activeTitle, t });
  }, [
    activeChat?.avatarUrl,
    activeChat?.displayName,
    activeChat?.peerId,
    activeConversation?.chatType,
    activeConversation?.group?.myRole,
    activeConversation?.peer?.displayName,
    activeConversation?.peer?.id,
    activeConversation?.peer?.link,
    activeTitle,
    contactsForAdd,
    groupMembersById,
    messages,
    readProfileFromCache,
    selectedLink,
    selfId,
    selfProfile?.avatarUrl,
    selfProfile?.id, t]);

  const openImageViewer = useCallback(
    (item: ChatImageGalleryItem) => {
      const index = chatImageGallery.findIndex(
        (entry) => entry.messageId === item.messageId && (entry.src === item.src || getCachedMediaUrl(entry.src) === item.src),
      );
      setImageViewer(item);
      setImageViewerIndex(index >= 0 ? index : 0);
      setImageViewerPanelVisible(true);
      setImageViewerMenuOpen(false);
    },
    [chatImageGallery],
  );

  const stepImageViewer = useCallback(
    (direction: -1 | 1) => {
      if (chatImageGallery.length === 0) return;
      const currentIndex =
        imageViewerIndex >= 0
          ? imageViewerIndex
          : chatImageGallery.findIndex(
            (entry) => entry.messageId === imageViewer?.messageId && entry.src === imageViewer?.src,
          );
      if (currentIndex < 0) return;
      const nextIndex = (currentIndex + direction + chatImageGallery.length) % chatImageGallery.length;
      const nextItem = chatImageGallery[nextIndex];
      if (!nextItem) return;
      setImageViewerDirection(direction);
      setImageViewer(nextItem);
      setImageViewerIndex(nextIndex);
      setImageViewerPanelVisible(true);
      setImageViewerMenuOpen(false);
    },
    [chatImageGallery, imageViewer, imageViewerIndex],
  );

  const handleImageViewerTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    imageViewerTouchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  }, []);

  const handleImageViewerTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!imageViewerTouchRef.current) return;
    const start = imageViewerTouchRef.current;
    imageViewerTouchRef.current = null;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const duration = Date.now() - start.time;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && duration < 650) {
      if (deltaX < 0) {
        stepImageViewer(1);
      } else {
        stepImageViewer(-1);
      }
    }
  }, [stepImageViewer]);

  useEffect(() => {
    if (!imageViewer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepImageViewer(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepImageViewer(1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setImageViewer(null);
        setImageViewerIndex(-1);
        setImageViewerPanelVisible(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageViewer, stepImageViewer]);

  const handleVideoViewerAuthorClick = useCallback(() => {
    return handleVideoViewerAuthorClickAction({ videoViewer, activeConversation, videoViewerRef, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying, setVideoViewerProgress, setVideoViewerCurrentTime, setVideoViewerMenuOpen, activeChat, openChannelModal, openProfileModal, messages, readProfileFromCache, groupMembersById, contactsForAdd });
  }, [
    activeChat?.link,
    activeConversation?.channel?.link,
    activeConversation?.chatType,
    activeConversation?.peer?.link,
    contactsForAdd,
    groupMembersById,
    messages,
    readProfileFromCache,
    videoViewer,
  ]);

  const handleImageViewerAuthorClick = useCallback(() => {
    return handleImageViewerAuthorClickAction({ imageViewer, activeConversation, setImageViewer, setImageViewerIndex, setImageViewerPanelVisible, setImageViewerMenuOpen, activeChat, openChannelModal, openProfileModal, messages, readProfileFromCache, groupMembersById, contactsForAdd });
  }, [
    activeChat?.link,
    activeConversation?.channel?.link,
    activeConversation?.chatType,
    activeConversation?.peer?.link,
    contactsForAdd,
    groupMembersById,
    imageViewer,
    messages,
    readProfileFromCache,
  ]);

  const resolveUnreadCount = useCallback(
    (chat: ChatSummary) => {
      return resolveUnreadCountAction({ selectedLink, unreadByLink, readMarkersRef, selfId }, chat);
    },
    [readMarkersVersion, selectedLink, selfId, unreadByLink],
  );

  const chatUnreadCountByLink = useMemo(() => {
    const map = new Map<string, number>();
    for (const chat of chats) {
      map.set(chat.link, resolveUnreadCount(chat));
    }
    return map;
  }, [chats, resolveUnreadCount]);

  return {
    replyComposerAuthor,
    canSubmitMessage,
    profileMediaVisible,
    chatSharedMediaList,
    chatSharedFilesList,
    chatSharedVoiceList,
    chatSharedMusicList,
    chatSharedLinksList,
    profileHeaderStatusText,
    chatImageGallery,
    openImageViewer,
    stepImageViewer,
    handleImageViewerTouchStart,
    handleImageViewerTouchEnd,
    handleVideoViewerAuthorClick,
    handleImageViewerAuthorClick,
    chatUnreadCountByLink
  };
}
