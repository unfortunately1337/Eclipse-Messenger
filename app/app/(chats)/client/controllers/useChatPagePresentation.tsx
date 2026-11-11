"use client";
import { useChatSidebarActions, useMessageListActions, useMessageListCallControls, useMessageListPins } from "../use-message-list-bindings";

import { useInviteArrival } from "@/lib/client/invite-transition";

import { useStableEvent } from "@/lib/client/use-stable-event";

import { useEffect } from "react";

import { showAppToast } from "@/lib/client/app-toast";

import { type LiveBackgroundSettings, updateLiveBackgroundSettings } from "@/lib/client/live-background";

import { MessageHelperPreview } from "../../components/common/MessageHelperPreview";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatDirectoryModel } from "./useChatDirectory";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { ChatAppearanceModel } from "./useChatAppearance";
import type { MessageReactionsModel } from "./useMessageReactions";
import type { ChatStoriesModel } from "./useChatStories";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ChatPagePresentationSources {
  page: Pick<ChatPageStateModel, "t" | "pollResults" | "handlePollVote" | "fetchPollResults" | "setSettingsPanelOpen" | "setSettingsPanelCovered" | "handleSwitchAccount" | "handleAddAccountClick"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalData">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "sendingMedia" | "chatListResolvedOnce" | "loadingConversation" | "decryptingConversation">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "editTarget">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyViewer">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "setDragActive">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "readMessageIds">;

  };
  active: Pick<ActiveConversationModel, "activeChat" | "calls">;
  presentation: Pick<ConversationPresentationModel, "isSecretChatAcceptRequired" | "helperMessage" | "helperParsed" | "helperIsMine" | "helperTimeText" | "helperShowChannelViews" | "helperChannelViewsText" | "helperShowDeliveryStatus" | "helperPendingLabel" | "helperReplyMessage" | "helperReplyAuthor" | "helperReplyPreviewText" | "activeTitle">;
  directory: Pick<ChatDirectoryModel, "orderedChats" | "activeReadReceiptIso">;
  history: Pick<MessageHistoryModel, "renderedMessages" | "messagePins">;
  appearance: Pick<ChatAppearanceModel, "mineMessageClassName" | "incomingMessageClassName" | "mineMessageGradientStyle" | "mineReplyPreviewThemeStyle">;
  reactions: Pick<MessageReactionsModel, "renderInlineReactions" | "renderLinkifiedText">;
  callbacks: Pick<ChatPageCallbacks, "openForwardAuthorProfile" | "uploadMediaFile" | "toggleChatListMenuFromButton" | "openCreateChat" | "createStoryFromSelection" | "beginForwardMessages" | "beginEditMessage" | "copyMessageText" | "deleteMessage" | "sendWelcomeSticker">;
  stories: Pick<ChatStoriesModel, "selfGroupIndex" | "openStoryViewer">;
}

export interface ChatPagePresentationModel {
  canPostToChannel: boolean;
  canSubscribeToChannel: boolean;
  canJoinGroup: boolean;
  hasChatInputBar: boolean;
  canDropChatFiles: boolean;
  showInitialChatListSkeleton: boolean;
  renderCenteredMessageHelperPreview: () => React.JSX.Element | null;
  closeSettingsPanel: () => void;
  handleSettingsTransitionComplete: () => void;
  uploadSettingsMedia: (file: Blob, kind: "image" | "voice" | "video" | "file" | "video_note" | "audio", durationMs?: number | undefined, scope?: {
    scopeType: string;
    scopeId: string;
    bot?: boolean | undefined;

  } | undefined) => Promise<{
    id: string;
    url: string;
    expiresAt?: string | null | undefined;

  }>;
  openSettingsStory: (source?: HTMLElement | undefined) => void;
  handleSettingsThemeUpdate: (settings: Partial<import("@/lib/client/live-background").LiveBackgroundSettings>) => void;
  sidebarActions: ReturnType<typeof useChatSidebarActions>;
  messageListActions: ReturnType<typeof useMessageListActions>;
  messageListCallControls: ReturnType<typeof useMessageListCallControls>;
  messageListPins: ReturnType<typeof useMessageListPins>;
  inviteArrivalRef: ReturnType<typeof useInviteArrival>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatPagePresentation(sources: ChatPagePresentationSources): ChatPagePresentationModel {
  const { t, setSettingsPanelOpen, setSettingsPanelCovered, handleSwitchAccount, handleAddAccountClick } = sources.page;
  const { activeConversation } = sources.page.conversation;
  const { selfId } = sources.page.account;
  const { channelModalData } = sources.page.mediaAndChannel;
  const { isDesktop } = sources.page.panels;
  const { sendingMedia, chatListResolvedOnce, loadingConversation, decryptingConversation } = sources.page.conversationRequest;
  const { editTarget } = sources.page.composerInteraction;
  const { storyViewer } = sources.page.storyDraft;
  const { setDragActive } = sources.page.wallpaperUpload;
  const { selectedLink } = sources.page.selection;
  const { activeChat, calls } = sources.active;
  const { isSecretChatAcceptRequired, helperMessage } = sources.presentation;
  const { orderedChats } = sources.directory;
  const { messagePins } = sources.history;
  const { openForwardAuthorProfile, uploadMediaFile, toggleChatListMenuFromButton, openCreateChat, createStoryFromSelection, beginForwardMessages, beginEditMessage, copyMessageText, deleteMessage, sendWelcomeSticker } = sources.callbacks;
  const { selfGroupIndex, openStoryViewer } = sources.stories;

  const activeChannel = activeConversation?.chatType === "channel" ? activeConversation.channel : null;

  const isChannelOwner = Boolean(
    (activeChannel && selfId && activeChannel.ownerId === selfId) ||
    (activeChannel as any)?.isOwner ||
    (activeChannel as any)?.myRole === "owner" ||
    (activeChat?.chatType === "channel" && (activeChat as any).isChannelOwner) ||
    (activeChat?.chatType === "channel" && (activeChat as any).ownerId && selfId && (activeChat as any).ownerId === selfId) ||
    (activeChat?.chatType === "channel" && activeChat.lastMessageMine) ||
    (channelModalData?.channel?.isOwner) ||
    (channelModalData?.channel?.myRole === "owner")
  );

  const canPostToChannel = Boolean(
    isChannelOwner ||
    (activeChannel as any)?.myRole === "admin" ||
    (activeChannel as any)?.myCanPostMessages ||
    (channelModalData?.channel?.myRole === "admin") ||
    (channelModalData?.channel?.myCanPostMessages)
  );

  const canSubscribeToChannel = Boolean(activeChannel && !activeChannel.isSubscribed && !isChannelOwner);

  const canJoinGroup = Boolean(
    activeConversation?.chatType === "group" &&
    activeConversation.group &&
    !activeConversation.group.myRole &&
    !activeConversation.members?.some((m) => m.id === selfId),
  );

  const hasChatInputBar = Boolean(
    !(activeConversation?.chatType === "channel" && !canPostToChannel) &&
    !canJoinGroup &&
    !isSecretChatAcceptRequired
  );

  const canDropChatFiles = Boolean(isDesktop && activeChat && activeConversation && hasChatInputBar && !sendingMedia && !editTarget && !storyViewer);

  useEffect(() => {
    setDragActive(false);
  }, [selectedLink, canDropChatFiles]);

  useEffect(() => {
    const reset = () => setDragActive(false);
    const preventFileNavigation = (event: DragEvent) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault();
      if (event.type === "drop") reset();
    };
    const onLeaveWindow = (event: DragEvent) => {
      if (!event.relatedTarget && (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight)) reset();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") reset(); };
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    window.addEventListener("dragend", reset);
    window.addEventListener("dragleave", onLeaveWindow);
    window.addEventListener("blur", reset);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("dragleave", onLeaveWindow);
      window.removeEventListener("blur", reset);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const showInitialChatListSkeleton = orderedChats.length === 0 && !chatListResolvedOnce;

  const renderCenteredMessageHelperPreview = () => {
    return helperMessage ? <MessageHelperPreview message={helperMessage} /> : null;
  };

  const closeSettingsPanel = useStableEvent(() => setSettingsPanelOpen(false));

  const handleSettingsTransitionComplete = useStableEvent(() => setSettingsPanelCovered(true));

  const uploadSettingsMedia = useStableEvent(uploadMediaFile);

  const openSettingsStory = useStableEvent((source?: HTMLElement) => {
    if (selfGroupIndex !== -1) openStoryViewer(selfGroupIndex, 0, source);
  });

  const handleSettingsThemeUpdate = useStableEvent((settings: Partial<LiveBackgroundSettings>) => {
    try {
      updateLiveBackgroundSettings(settings);
    } catch (failure) {
      // The theme editor retains the draft and shows its inline storage error.
      if (settings.customTheme) throw failure;
      showAppToast({ type: "error", title: t("Не удалось сохранить оформление. Проверьте свободное место и настройки хранилища браузера.") });
    }
  });

  const sidebarActions = useChatSidebarActions({
    toggleChatListMenuFromButton, handleSwitchAccount, handleAddAccountClick,
    openCreateChat, createStoryFromSelection,
  });

  const messageListActions = useMessageListActions({
    openForwardAuthorProfile, beginForwardMessages, beginEditMessage,
    copyMessageText, deleteMessage, sendWelcomeSticker,
  });

  const messageListCallControls = useMessageListCallControls(calls);

  const messageListPins = useMessageListPins(messagePins);

  const inviteArrivalRef = useInviteArrival(Boolean(activeConversation && !loadingConversation && !decryptingConversation), (activeConversation?.chatType === "group" ? activeConversation.group?.link : activeConversation?.chatType === "channel" ? activeConversation.channel?.link : "") ?? "", activeConversation?.chatType ?? "");

  return {
    canPostToChannel,
    canSubscribeToChannel,
    canJoinGroup,
    hasChatInputBar,
    canDropChatFiles,
    showInitialChatListSkeleton,
    renderCenteredMessageHelperPreview,
    closeSettingsPanel,
    handleSettingsTransitionComplete,
    uploadSettingsMedia,
    openSettingsStory,
    handleSettingsThemeUpdate,
    sidebarActions,
    messageListActions,
    messageListCallControls,
    messageListPins,
    inviteArrivalRef
  };
}
