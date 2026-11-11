"use client";

import { ImportedSticker } from "@/components/PackMedia";
import { importedItemIdFromSrc } from "@/lib/imported-packs";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { IoCopy, IoArrowRedo } from "react-icons/io5";
import { BotInlineKeyboard } from "../components/common/BotInlineKeyboard";
import { memo } from "react";
import { Check, Download, SquarePlay } from "lucide-react";
import { BsPinAngleFill } from "react-icons/bs";

import CallMessageBubble from "../components/common/CallMessageBubble";
import { readCallMessage } from "@/lib/call-history";

import { IoMdEye } from "react-icons/io";
import { GrRadialSelected } from "react-icons/gr";
import { FaReply } from "react-icons/fa";
import { MdDelete, MdEdit } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar } from "@/components/ui/media";
import { Button } from "@/components/ui/button";
import { EclipseSystemMessageBubble } from "../EclipseChatUi";
import { cn } from "@/lib/utils";
import { ForwardedMessageHeader } from "../components/common/ForwardedMessageHeader";
import { readForwardedContent } from "@/lib/client/message-forwarding";
import { MediaReplyLayout } from "../components/common/MediaReplyLayout";
import { VoiceMessageBubble, VideoCircleBubble, MusicMessageBubble, MessageBubbleTail, MediaMessageTail } from "../components/common/MessageBubbles";
import { MessageMeta, MessageStatusTicks } from "../components/common/MessageStatus";
import { FailedMessageBadge } from "../components/common/FailedMessageActions";
import { MessageHelperPreviewSource } from "../components/common/MessageHelperPreview";
import ChatPoll from "@/components/ChatPoll";
import { WallpaperSystemBubble } from "@/components/WallpaperSystemBubble";
import { renderEmojiText } from "@/components/EmojiText";
import { resolveMessageMedia } from "@/lib/client/media-crypto";
import { getMessageSelectionNeighbors } from "../chat-message-state";
import { decodeWaveformFromMessage } from "@/lib/client/voice-waveform";
import { LottieSticker } from "./legacy-stickers";
import { formatMessageTimeLabel, formatMessageDayLabel, resolveStackedBubbleShape, resolveStackedMediaShape, pickGroupNameColor, isWelcomeStickerSrc, getReplyPreviewText, renderReplyBubblePreview, renderStoryReplyBubblePreview, renderBubbleMeta, albumGridContainerClass, albumGridItemClass, MESSAGE_TEXT_WRAP_CLASS } from "./message-presentation";
import { parseMessageContentCached, canEditMessageContent, canEditMessage, hasDetachedMessageAnnotations, getEmojisList, renderTextWithEmojis } from "./message-content";
import { isMessageReadByMarker } from "./chat-cache";
import { formatMediaViewerDate } from "./media-recording";
import { ChatVideoThumb, ChatImageThumb } from "./media-thumbnails";
import { formatFileSize } from "./media-files";
import type { ConversationMessagesProps } from "./ConversationMessages";
import { areMessageRowPropsEqual, type MessageRowProps } from "./message-row-equality";

const SHARED_ROW_PROPS = [
  "isSecretChat",
  "messagePins",
  "selectionMode",
  "isDesktop",
  "t",
  "activeTitle",
  "isManagedBotConversation",
  "syncing",
  "sendWelcomeSticker",
  "selfId",
  "selfProfile",
  "currentUserIdRef",
  "activeConversation",
  "getMessageRowRef",
  "dateSeparatorThemeStyle",
  "mineMessageClassName",
  "incomingMessageClassName",
  "mineMessageGradientStyle",
  "calls",
  "activeChat",
  "handleApplyPeerWallpaper",
  "applyingWallpaper",
  "channelModalData",
  "removingMessageIds",
  "groupMembersById",
  "readProfileFromCache",
  "contactsForAdd",
  "selectedLink",
  "messages",
  "hasComposerText",
  "hasPendingImage",
  "hasPendingVideo",
  "hasPendingAudio",
  "hasSentWelcomeSticker",
  "readMessageIds",
  "activeReadReceiptIso",
  "replyMessageById",
  "mineReplyPreviewThemeStyle",
  "scrollToMessageById",
  "openForwardAuthorProfile",
  "selectedMessageIdSet",
  "messageHelperId",
  "toggleMessageSelection",
  "hoverReactionLeaveTimerRef",
  "hoverReactionTimerRef",
  "setHoverReactionMessageId",
  "setHoverReactionExpandedMessageId",
  "highlightedMessageId",
  "swipeMessageId",
  "swipeOffsetX",
  "isCoarsePointer",
  "setMessageHelperId",
  "beginMessageSwipe",
  "messageLongPressStartRef",
  "clearMessageLongPress",
  "moveMessageSwipe",
  "endMessageSwipe",
  "messageLongPressTriggeredRef",
  "lastTapRef",
  "messageSwipeStartRef",
  "setSwipeMessageId",
  "setSwipeOffsetX",
  "messageLongPressTimerRef",
  "renderInlineReactions",
  "composerInputThemeStyle",
  "setVideoViewer",
  "setVideoViewerFailed",
  "setVideoViewerPlaying",
  "openImageViewer",
  "renderLinkifiedText",
  "pollResults",
  "handlePollVote",
  "fetchPollResults",
  "hasAllowedReactions",
  "hoverReactionMessageId",
  "hoverReactionExpandedMessageId",
  "hoverReactionEmojis",
  "toggleReaction",
  "defaultQuickReaction",
  "shouldUseLegacyMessageHelper",
  "messageHelperHorizontalPlacement",
  "helperReactionEmojis",
  "setStoryReplyTarget",
  "setReplyToMessageId",
  "beginForwardMessages",
  "editSaving",
  "editTarget",
  "beginEditMessage",
  "copyMessageText",
  "beginSelectionMode",
  "deletingMessageId",
  "deleteMessage"
] as const satisfies readonly (keyof ConversationMessagesProps)[];

export const ConversationMessageRow = memo(function ConversationMessageRow({ row, shared }: MessageRowProps) {
  const { message, index, top, showDateSeparator, rowSpacingClassName, chainWithPrevious, chainWithNext } = row;
  const { isSecretChat, messagePins, selectionMode, isDesktop, t, activeTitle, isManagedBotConversation, syncing, sendWelcomeSticker, selfId, selfProfile, currentUserIdRef, activeConversation, getMessageRowRef, dateSeparatorThemeStyle, mineMessageClassName, incomingMessageClassName, mineMessageGradientStyle, calls, activeChat, handleApplyPeerWallpaper, applyingWallpaper, channelModalData, removingMessageIds, groupMembersById, readProfileFromCache, contactsForAdd, selectedLink, messages, hasComposerText, hasPendingImage, hasPendingVideo, hasPendingAudio, hasSentWelcomeSticker, readMessageIds, activeReadReceiptIso, replyMessageById, mineReplyPreviewThemeStyle, scrollToMessageById, openForwardAuthorProfile, selectedMessageIdSet, messageHelperId, toggleMessageSelection, hoverReactionLeaveTimerRef, hoverReactionTimerRef, setHoverReactionMessageId, setHoverReactionExpandedMessageId, highlightedMessageId, swipeMessageId, swipeOffsetX, isCoarsePointer, setMessageHelperId, beginMessageSwipe, messageLongPressStartRef, clearMessageLongPress, moveMessageSwipe, endMessageSwipe, messageLongPressTriggeredRef, lastTapRef, messageSwipeStartRef, setSwipeMessageId, setSwipeOffsetX, messageLongPressTimerRef, renderInlineReactions, composerInputThemeStyle, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying, openImageViewer, renderLinkifiedText, pollResults, handlePollVote, fetchPollResults, hasAllowedReactions, hoverReactionMessageId, hoverReactionExpandedMessageId, hoverReactionEmojis, toggleReaction, defaultQuickReaction, shouldUseLegacyMessageHelper, messageHelperHorizontalPlacement, helperReactionEmojis, setStoryReplyTarget, setReplyToMessageId, beginForwardMessages, editSaving, editTarget, beginEditMessage, copyMessageText, beginSelectionMode, deletingMessageId, deleteMessage } = shared;

const callMessage = activeConversation?.chatType === "direct" ? readCallMessage(message.systemPayload) : null;
if (message.systemPayload && message.systemPayload.botRole !== "user" && !callMessage) {
  const timeText = formatMessageTimeLabel(message.createdAt);
  const dateSeparatorLabel = showDateSeparator ? formatMessageDayLabel(message.createdAt) : "";
  const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? "";
  const isWallpaperChange = message.systemPayload?.eventType === "wallpaper_change";

  if (isWallpaperChange) {
    const currentChatWallpaper = activeConversation?.wallpaperUrl || activeChat?.wallpaperUrl;
    const msgWallpaperUrl = message.systemPayload?.metadata?.wallpaperUrl;
    const isApplied = Boolean(currentChatWallpaper && msgWallpaperUrl && currentChatWallpaper === msgWallpaperUrl);
    const wallpaperSenderId = message.systemPayload?.metadata?.senderId;
    const isMine = Boolean(
      message.pending ||
      (effectiveSelfId && (message.senderId === effectiveSelfId || wallpaperSenderId === effectiveSelfId))
    );

    return (
      <div
        key={message.id}
        data-message-id={message.id}
        data-message-date={message.createdAt}
        ref={getMessageRowRef(message.id, message.localId)}
        className="px-0 pb-1"
        style={{ position: "absolute", top, left: 0, right: 0 }}
      >
        {showDateSeparator ? (
          <div className="mb-1.5 flex justify-center">
            <span
              className="chat-service-pill"
              style={dateSeparatorThemeStyle}
            >
              {dateSeparatorLabel}
            </span>
          </div>
        ) : null}
        <WallpaperSystemBubble
          messageId={message.id}
          payload={message.systemPayload}
          selfId={effectiveSelfId}
          isMine={isMine}
          peerName={activeConversation?.peer?.displayName || activeTitle || activeChat?.displayName || t("Пользователь")}
          isApplied={isApplied}
          dateSeparatorThemeStyle={dateSeparatorThemeStyle}
          onApplyWallpaper={(url, posY) => void handleApplyPeerWallpaper(url, posY)}
          applying={applyingWallpaper}
        />
      </div>
    );
  }

  return (
    <div
      key={message.id}
      data-message-id={message.id}
      data-message-date={message.createdAt}
      ref={getMessageRowRef(message.id, message.localId)}
      className={cn("px-0", rowSpacingClassName)}
      style={{ position: "absolute", top, left: 0, right: 0 }}
    >
      {showDateSeparator ? (
        <div className="mb-1.5 flex justify-center">
          <span
            className="chat-service-pill"
            style={dateSeparatorThemeStyle}
          >
            {dateSeparatorLabel}
          </span>
        </div>
      ) : null}
      <div className={cn("flex px-1", ((!message.systemPayload?.body && !message.systemPayload?.metadata?.telegramImportConnect && !message.systemPayload?.metadata?.packImport) || message.systemPayload.eventType === "community_created" || message.systemPayload.eventType === "service") ? "justify-center w-full" : "justify-start")}>
        <EclipseSystemMessageBubble
          messageId={message.id}
          payload={message.systemPayload}
          serviceStyle={dateSeparatorThemeStyle}
          bubbleClassName={incomingMessageClassName}
          timeText={timeText}
          createdAt={message.createdAt}
        />
      </div>
    </div>
  );
}
const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
const rawIsMine = callMessage ? callMessage.callerId === effectiveSelfId : message.pending ? true : (effectiveSelfId ? message.senderId === effectiveSelfId : false);
const isChannelChat = activeConversation?.chatType === "channel";
const isMine = isChannelChat ? false : (activeConversation?.chatType === "saved" || rawIsMine);
const rawParsed = parseMessageContentCached(message.text, false);
const parsed = resolveMessageMedia(rawParsed);
const isGroupChat = activeConversation?.chatType === "group";
const canModerateGroupMessages =
  isGroupChat &&
  (activeConversation?.group?.myRole === "owner" || activeConversation?.group?.myRole === "admin");
const canModerateChannelMessages =
  isChannelChat &&
  Boolean(
    (activeConversation?.channel && selfId && activeConversation.channel.ownerId === selfId) ||
    channelModalData?.channel?.isOwner ||
    channelModalData?.channel?.myCanManageAdmins
  );
const isEditable = !readForwardedContent(message.text) && (isChannelChat
  ? (rawIsMine || canModerateChannelMessages) && canEditMessageContent(parsed)
  : canEditMessage(message, parsed, rawIsMine));
const isRemoving = removingMessageIds.has(message.id);
const dissolveTargetClass = isRemoving
  ? isMine
    ? "message-dissolve-target message-dissolve-target-mine"
    : "message-dissolve-target message-dissolve-target-incoming"
  : "";
const stackedBubbleShapeClass = resolveStackedBubbleShape({
  isMine,
  chainWithPrevious,
  chainWithNext,
});
const stackedMediaShapeClass = resolveStackedMediaShape({
  isMine,
  chainWithPrevious,
  chainWithNext,
});
const hasTail = !chainWithNext && parsed.kind !== "sticker";
const bubbleTailClass = "";
const isSameSenderChain =
  isGroupChat &&
  chainWithPrevious;
const showGroupMeta = isGroupChat && !isMine && !isSameSenderChain;
const senderMeta = isGroupChat ? groupMembersById.get(message.senderId) ?? null : null;
const senderProfile = readProfileFromCache(message.senderId);
const senderName =
  message.senderDisplayName ||
  senderMeta?.displayName ||
  senderProfile?.displayName ||
  (isMine ? t("Вы") : t("Пользователь"));
const senderAvatarUrl = senderMeta?.avatarUrl ?? senderProfile?.avatarUrl ?? null;
const contactMatch = !isMine ? contactsForAdd.find((c) => {
  if (message.senderId && c.id === message.senderId) return true;
  if (senderProfile?.link && c.link && c.link.toLowerCase() === senderProfile.link.toLowerCase()) return true;
  if (activeConversation?.chatType === "direct") {
    if (activeConversation.peer?.id && c.id === activeConversation.peer.id) return true;
    if (activeChat?.peerId && c.id === activeChat.peerId) return true;
    if (activeConversation.peer?.link && c.link && c.link.toLowerCase() === activeConversation.peer.link.toLowerCase()) return true;
    if (selectedLink && c.link && c.link.toLowerCase() === selectedLink.toLowerCase()) return true;
  }
  return false;
}) : null;
const contactName = contactMatch?.alias?.trim();
const mediaViewerAuthorName = activeConversation?.chatType === "channel"
  ? activeTitle || activeChat?.displayName || t("Канал")
  : isMine
    ? t("Вы")
    : contactName
      ? contactName
      : activeConversation?.chatType === "direct"
        ? activeConversation?.peer?.displayName || senderProfile?.displayName || activeTitle || activeChat?.displayName || t("Пользователь")
        : senderProfile?.displayName || message.senderDisplayName || senderMeta?.displayName || t("Пользователь");
const mediaViewerAuthorAvatarUrl = activeConversation?.chatType === "channel"
  ? activeChat?.avatarUrl ?? null
  : isMine
    ? selfProfile?.avatarUrl ?? null
    : activeConversation?.chatType === "direct"
      ? activeChat?.avatarUrl ?? null
      : senderAvatarUrl;
const mediaViewerAuthorLink = activeConversation?.chatType === "channel"
  ? null
  : isMine
    ? null
    : activeConversation?.chatType === "direct"
      ? activeConversation?.peer?.link || activeChat?.link || null
      : senderProfile?.link || senderMeta?.link || contactMatch?.link || null;
const senderColor = pickGroupNameColor(message.senderId);
const isWelcomeSticker = parsed.kind === "sticker" && isWelcomeStickerSrc(parsed.src);
const isLastMessage = index === messages.length - 1;
const showWelcomeReplyButton =
  isWelcomeSticker &&
  activeConversation?.chatType !== "channel" &&
  parsed.source !== "picker" &&
  !isMine &&
  isLastMessage &&
  !hasComposerText &&
  !hasPendingImage &&
  !hasPendingVideo &&
  !hasPendingAudio &&
  !hasSentWelcomeSticker;
const showDeliveryStatus =
  rawIsMine &&
  (message.pending || activeConversation?.chatType !== "channel");
const pendingLabel = message.pending ? t("Отправка") : null;
const showChannelViews = activeConversation?.chatType === "channel" && !message.pending && !message.sendFailure;
const channelViewsValue = Number(message.viewsCount ?? 0);
const channelViewsText = showChannelViews
  ? `${Math.max(1, Number.isFinite(channelViewsValue) ? channelViewsValue : 0)}`
  : `${message.viewsCount ?? "0"}`;
const isRead =
  readMessageIds.has(message.id) ||
  ((message.readBy?.length ?? 0) > 0) ||
  (isMine && isMessageReadByMarker(activeReadReceiptIso, message.createdAt));
const dateSeparatorLabel = showDateSeparator ? formatMessageDayLabel(message.createdAt) : "";
const timeText = formatMessageTimeLabel(message.createdAt);
const repliedMessage = message.replyToMessageId ? replyMessageById.get(message.replyToMessageId) ?? null : null;
const replyProfile = repliedMessage ? readProfileFromCache(repliedMessage.senderId) : null;
const replyAuthor =
  repliedMessage
    ? activeConversation?.chatType === "channel"
      ? activeTitle || activeChat?.displayName || t("Канал")
      : repliedMessage.senderId === selfId
        ? selfProfile?.displayName || selfProfile?.link || t("Я")
        : repliedMessage.senderDisplayName ||
        replyProfile?.displayName ||
        (activeConversation?.chatType === "direct"
          ? activeTitle || t("Собеседник")
          : t("Собеседник"))
    : "Сообщение";
const replyPreview = repliedMessage ? getReplyPreviewText(repliedMessage.text) : t("Ответ на сообщение");
const replyLineColor =
  isGroupChat && repliedMessage ? pickGroupNameColor(repliedMessage.senderId) : undefined;
const storyReplyLineColor =
  isGroupChat && !isMine ? pickGroupNameColor(message.senderId) : undefined;
const originalReplyPreviewBlock = message.replyToMessageId
  ? renderReplyBubblePreview({
    isMine,
    author: replyAuthor,
    preview: replyPreview,
    lineColor: replyLineColor,
    mineThemeStyle: mineReplyPreviewThemeStyle,
    onClick: () => scrollToMessageById(message.replyToMessageId!),
  })
  : parsed.kind === "story_reply"
    ? renderStoryReplyBubblePreview({
      isMine,
      author: activeConversation?.chatType === "channel"
        ? activeTitle || activeChat?.displayName || t("Канал")
        : parsed.authorName || (isMine ? (selfProfile?.displayName || selfProfile?.link || t("Я")) : t("Собеседник")),
      preview: parsed.previewText && !["Фотоистория", "Видеоистория", "История"].includes(parsed.previewText)
        ? getReplyPreviewText(parsed.previewText) : undefined,
      lineColor: storyReplyLineColor,
      mineThemeStyle: mineReplyPreviewThemeStyle,
    })
    : null;
const originalForwardAuthor = readForwardedContent(message.text)?.author;
const forwardAuthor = activeConversation?.chatType === "saved" && originalForwardAuthor?.id === selfId ? undefined : originalForwardAuthor;
const detachedForward = Boolean(forwardAuthor) && hasDetachedMessageAnnotations(parsed);
const hasSenderBubble = !detachedForward && (Boolean(forwardAuthor) || !(parsed.kind === "sticker" || parsed.kind === "text" && parsed.isOnlyEmojis || parsed.kind === "video" && parsed.mode !== "file"));
const groupSenderHeader = showGroupMeta && hasSenderBubble ? (
  <div data-group-sender-name className={cn("mb-0.5 min-w-0 truncate text-[12px] font-semibold leading-4", senderColor, (parsed.kind === "image" || parsed.kind === "album" || parsed.kind === "video" && parsed.mode === "file") && "px-2.5 pt-1.5")}>
    <VerifiedTitle emojiStatusInteractive={false} kind="user" link={senderMeta?.link || senderProfile?.link || ""}>{senderName}</VerifiedTitle>
  </div>
) : null;
const detachedForwardHeader = detachedForward && forwardAuthor ? <ForwardedMessageHeader detached author={forwardAuthor} selfId={selfId} onAuthorClick={openForwardAuthorProfile} /> : null;
const forwardedAuthorHeader = forwardAuthor && !detachedForward ? <div className={parsed.kind === "image" || parsed.kind === "album" || parsed.kind === "video" && parsed.mode === "file" ? "px-2.5 pt-1.5" : undefined}><ForwardedMessageHeader compact={parsed.kind !== "text"} author={forwardAuthor} selfId={selfId} onAuthorClick={openForwardAuthorProfile} /></div> : null;
const forwardHeader = groupSenderHeader || forwardedAuthorHeader ? <>{groupSenderHeader}{forwardedAuthorHeader}</> : null;
const detachedReply = Boolean(originalReplyPreviewBlock) && hasDetachedMessageAnnotations(parsed);
const detachedReplyBlock = detachedReply ? renderReplyBubblePreview({
  isMine, detached: true, author: replyAuthor, preview: replyPreview, lineColor: replyLineColor,
  mineThemeStyle: mineReplyPreviewThemeStyle,
  onClick: () => scrollToMessageById(message.replyToMessageId!),
}) : null;
const inlineReply = detachedReply ? null : originalReplyPreviewBlock;
const replyPreviewBlock = forwardHeader || inlineReply ? <>{forwardHeader}{inlineReply}</> : null;
const reactions = message.reactions ?? [];
const isSelectedMessage = selectedMessageIdSet.has(message.id);
// index belongs to the full history, not the virtual render window.
const selectionNeighbors = selectionMode ? getMessageSelectionNeighbors(messages, index, selectedMessageIdSet) : null;
const isPrevSelected = selectionNeighbors?.previous ?? false;
const isNextSelected = selectionNeighbors?.next ?? false;
const selectionRoundingClass = !isPrevSelected && !isNextSelected
  ? "rounded-2xl"
  : !isPrevSelected && isNextSelected
    ? "rounded-t-2xl rounded-b-none"
    : isPrevSelected && isNextSelected
      ? "rounded-none"
      : "rounded-b-2xl rounded-t-none";
const shouldStackMediaFooter =
  parsed.kind === "sticker" || (parsed.kind === "video" && parsed.mode !== "file");




return (
  <>
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {showDateSeparator ? (
        <div className="mb-1.5 w-full text-center">
          <span
            className="chat-service-pill"
            style={dateSeparatorThemeStyle}
          >
            {dateSeparatorLabel}
          </span>
        </div>
      ) : null}
      <div
        onClickCapture={selectionMode ? (event) => {
          event.stopPropagation();
          event.preventDefault();
          toggleMessageSelection(message.id);
        } : undefined}
        className={cn(
          "relative flex w-full flex-col transition-colors duration-150 ease-out py-0",
          selectionMode ? "cursor-pointer select-none" : ""
        )}
      >
        {selectionMode ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 -inset-x-2 sm:-inset-x-3 md:-inset-x-4 transition-all duration-200 ease-out",
              selectionRoundingClass,
              isSelectedMessage
                ? "opacity-100 bg-white/[0.08] dark:bg-white/[0.09]"
                : "opacity-0 pointer-events-none"
            )}
          />
        ) : null}
        <div className="relative flex w-full">
          {selectionMode ? (
            <div
              data-message-selection-indicator
              className={cn(
                "absolute bottom-1 z-20 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200 ease-out",
                isMine ? "right-1.5" : "left-1.5",
                isSelectedMessage
                  ? "border-transparent bg-[#5288c1] text-white scale-100 shadow-md"
                  : "border-white/40 bg-black/25 text-transparent scale-95 backdrop-blur-sm hover:border-white/60"
              )}
            >
              <Check
                size={14}
                strokeWidth={2.8}
                className={cn(
                  "transition-all duration-200 ease-out",
                  isSelectedMessage ? "scale-100 opacity-100 rotate-0 text-white" : "scale-50 opacity-0 -rotate-45"
                )}
              />
            </div>
          ) : null}
          <div
            className={`flex min-w-0 w-full ${isMine ? "justify-end" : "justify-start"
              } ${selectionMode ? (isMine ? "pr-12" : "pl-12") : ""}`}
          >
            {isGroupChat && !isMine ? (
              <div data-group-sender-avatar className="mr-2 mb-0.5 flex w-7 shrink-0 self-end flex-col items-center">
                {!chainWithNext ? (
                  <button type="button"
                    aria-label={t("Открыть профиль: {0}", { 0: senderName })}
                    className="block h-7 w-7 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    onPointerDown={event => { if (!selectionMode) event.stopPropagation(); }}
                    onClick={event => {
                      if (selectionMode) return;
                      event.stopPropagation();
                      openForwardAuthorProfile({ id: message.senderId, name: senderName,
                        link: senderMeta?.link || senderProfile?.link || contactMatch?.link,
                        avatarUrl: senderAvatarUrl, kind: "user" });
                    }}>
                  <MediaAvatar
                    src={senderAvatarUrl ?? undefined}
                    alt={senderName}
                    className="h-7 w-7"
                    fallbackText={(senderName || "U").slice(0, 1)}
                    autoPlay
                  />
                  </button>
                ) : (
                  <div className="h-7 w-7" />
                )}
              </div>
            ) : null}
            <div
              data-message-preview-origin={message.id}
              style={{ marginRight: message.sendFailure && rawIsMine && isMine ? 24 : 0, marginLeft: message.sendFailure && rawIsMine && !isMine ? 24 : 0, transition: "margin 160ms ease-out" }}
              className={`min-w-0 max-w-[86%] sm:max-w-[82%] md:max-w-[60%] xl:max-w-[56%] [&_.message-bubble-target]:max-w-full ${messageHelperId === message.id
                ? "relative drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
                : ""
                } ${shouldStackMediaFooter ? "flex w-fit flex-col items-center self-start" : ""}`}
            >
              <div
                data-message-helper-anchor="true"
                data-message-mine={isMine ? "true" : "false"}
                onMouseEnter={() => {
                  if (!isDesktop || selectionMode || messageHelperId) return;
                  if (hoverReactionLeaveTimerRef.current) {
                    clearTimeout(hoverReactionLeaveTimerRef.current);
                    hoverReactionLeaveTimerRef.current = null;
                  }
                  if (hoverReactionTimerRef.current) {
                    clearTimeout(hoverReactionTimerRef.current);
                    hoverReactionTimerRef.current = null;
                  }
                  setHoverReactionMessageId(message.id);
                }}
                onMouseLeave={() => {
                  if (hoverReactionTimerRef.current) {
                    clearTimeout(hoverReactionTimerRef.current);
                    hoverReactionTimerRef.current = null;
                  }
                  hoverReactionLeaveTimerRef.current = setTimeout(() => {
                    setHoverReactionMessageId((curr) => (curr === message.id ? null : curr));
                    setHoverReactionExpandedMessageId((curr) => (curr === message.id ? null : curr));
                  }, 350);
                }}
                className={cn(
                  "relative transition-[transform,opacity] duration-150",
                  highlightedMessageId === message.id
                    ? "telegram-reply-highlight"
                    : "",
                )}
                style={
                  {
                    ...(swipeMessageId === message.id
                      ? { transform: `translateX(${swipeOffsetX}px)`, transition: "transform 120ms ease-out" }
                      : {}),
                    ...(isCoarsePointer
                      ? {
                        WebkitTouchCallout: "none",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                      }
                      : {}),
                  }
                }
                onDoubleClick={() => {
                  if (selectionMode) {
                    toggleMessageSelection(message.id);
                    return;
                  }
                  if (isCoarsePointer) return;
                  setMessageHelperId((prev) => (prev === message.id ? null : message.id));
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (selectionMode) {
                    toggleMessageSelection(message.id);
                    return;
                  }
                  if (isCoarsePointer) return;
                  setMessageHelperId((prev) => (prev === message.id ? null : message.id));
                }}
                onTouchStart={(event) => {
                  if (selectionMode) return;
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('[data-reaction-button="true"]')) {
                    return;
                  }
                  beginMessageSwipe(event, message, isMine);
                }}
                onTouchMove={(event) => {
                  if (isCoarsePointer && messageLongPressStartRef.current) {
                    const touch = event.touches[0];
                    if (touch) {
                      const dx = touch.clientX - messageLongPressStartRef.current.x;
                      const dy = touch.clientY - messageLongPressStartRef.current.y;
                      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                        clearMessageLongPress();
                      }
                    }
                  }
                  moveMessageSwipe(event);
                }}
                onTouchEnd={() => {
                  const wasSwipe = swipeMessageId === message.id && Math.abs(swipeOffsetX) > 20;
                  endMessageSwipe(message);
                  if (wasSwipe) {
                    clearMessageLongPress();
                    return;
                  }
                  if (selectionMode) {
                    toggleMessageSelection(message.id);
                    clearMessageLongPress();
                    return;
                  }
                  if (isCoarsePointer) {
                    const didLongPress = messageLongPressTriggeredRef.current;
                    clearMessageLongPress();
                    if (didLongPress) {
                      return;
                    }
                  } else {
                    const now = Date.now();
                    const lastTap = lastTapRef.current;
                    if (lastTap && lastTap.id === message.id && now - lastTap.at <= 280) {
                      setMessageHelperId((prev) => (prev === message.id ? null : message.id));
                    }
                    lastTapRef.current = { id: message.id, at: now };
                  }
                }}
                onTouchCancel={() => {
                  messageSwipeStartRef.current = null;
                  setSwipeMessageId(null);
                  setSwipeOffsetX(0);
                  clearMessageLongPress();
                }}
                onClick={(event) => {
                  if (!selectionMode) return;
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('[data-reaction-button="true"]')) return;
                  toggleMessageSelection(message.id);
                }}
                onTouchStartCapture={(event) => {
                  if (selectionMode) return;
                  if (!isCoarsePointer) return;
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('[data-reaction-button="true"]')) return;
                  const touch = event.touches[0];
                  if (!touch) return;
                  if (messageLongPressTimerRef.current) {
                    window.clearTimeout(messageLongPressTimerRef.current);
                  }
                  messageLongPressTriggeredRef.current = false;
                  messageLongPressStartRef.current = { x: touch.clientX, y: touch.clientY };
                  messageLongPressTimerRef.current = window.setTimeout(() => {
                    messageLongPressTriggeredRef.current = true;
                    setMessageHelperId((prev) => (prev === message.id ? null : message.id));
                  }, 450);
                }}
              >
                <MessageHelperPreviewSource id={message.id} active={messageHelperId === message.id} isMine={isMine}>
                <MediaReplyLayout quote={detachedForwardHeader || detachedReplyBlock ? <div data-detached-message-annotations className="space-y-2">{detachedForwardHeader}{detachedReplyBlock}</div> : null} isMine={isMine}>
                  {callMessage ? (
                    <CallMessageBubble call={callMessage} selfId={effectiveSelfId ?? ""} timeText={timeText} hasTail={hasTail}
                      reactionsSlot={renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                      className={cn(isMine ? mineMessageClassName : incomingMessageClassName, stackedBubbleShapeClass, "message-bubble-target", dissolveTargetClass)}
                      style={isMine ? mineMessageGradientStyle : undefined}
                      disabled={!selectionMode && (!calls.enabled || calls.busy || Boolean(calls.current))}
                      onCall={() => { if (selectionMode) return; const link = activeConversation?.peer?.link; if (link) void calls.start(callMessage.mode, { kind: "direct", link }); }}
                    />
                  ) : parsed.kind === "text" && parsed.isOnlyEmojis ? (
                    <div className={`flex flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}`}>
                      <div
                        className={`relative ${reactions.length > 0 ? "pb-14" : "pb-6"} transition-opacity duration-75 ${stackedBubbleShapeClass} ${dissolveTargetClass}`}
                      >
                        {(() => {
                          const count = parsed.emojiCount || 1;
                          const emojiList = getEmojisList(parsed.text);
                          if (count <= 3 && emojiList.length > 0 && emojiList.length <= 3) {
                            const emojiSize = count === 1 ? (isDesktop ? 144 : 116) : count === 2 ? (isDesktop ? 76 : 68) : (isDesktop ? 60 : 52);
                            return (
                              <div className="flex flex-row items-center justify-center gap-2 select-none animate-scale-up py-0.5">
                                {emojiList.map((e, idx) => {
                                  return (
                                    <span key={`${idx}-${e}`} style={{ width: emojiSize, height: emojiSize }} className="flex items-center justify-center">
                                      {renderEmojiText(e, { size: emojiSize })}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          }
                          const size = isDesktop ? 36 : 32;
                          return (
                            <div className="flex flex-wrap items-center gap-1 max-w-[220px] md:max-w-[280px] py-1 select-none animate-scale-up">
                              {renderEmojiText(parsed.text, { size })}
                            </div>
                          );
                        })()}
                        <div className={`pointer-events-none absolute ${reactions.length > 0 ? "bottom-8" : "bottom-0"} ${isMine ? "right-2" : "left-2"}`}>
                          {renderBubbleMeta({
                            timeText,
                            showChannelViews,
                            channelViewsText,
                            showDeliveryStatus,
                            isRead,
                            pendingLabel,
                            overlay: true,
                          })}
                        </div>
                        {reactions.length > 0 ? (
                          <div className={`pointer-events-auto absolute bottom-0 z-20 ${isMine ? "right-2" : "left-2"}`}>
                            {renderInlineReactions(message.id, reactions, isMine, {
                              noTopMargin: true,
                              align: isMine ? "end" : "start",
                              rtl: isMine,
                              overlay: true,
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : parsed.kind === "sticker" ? (
                    <div className={`flex flex-col gap-1.5 ${isMine ? "items-end" : "items-start"}`}>
                      {forwardHeader}
                      <div
                        className={`relative ${reactions.length > 0 ? "pb-14" : "pb-6"} transition-opacity duration-75 ${stackedBubbleShapeClass} ${dissolveTargetClass}`}
                      >
                        {importedItemIdFromSrc(parsed.src) ? <ImportedSticker src={parsed.src} className="h-[140px] w-[140px] md:h-[180px] md:w-[180px]" /> : <LottieSticker src={parsed.src} className="h-[140px] w-[140px] md:h-[180px] md:w-[180px]" />}
                        <div className={`pointer-events-none absolute ${reactions.length > 0 ? "bottom-8" : "bottom-0"} ${isMine ? "right-2" : "left-2"}`}>
                          {renderBubbleMeta({
                            timeText,
                            showChannelViews,
                            channelViewsText,
                            showDeliveryStatus,
                            isRead,
                            pendingLabel,
                            overlay: true,
                          })}
                        </div>
                        {reactions.length > 0 ? (
                          <div className={`pointer-events-auto absolute bottom-0 z-20 ${isMine ? "right-2" : "left-2"}`}>
                            {renderInlineReactions(message.id, reactions, isMine, {
                              noTopMargin: true,
                              align: isMine ? "end" : "start",
                              rtl: isMine,
                              overlay: true,
                            })}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex w-full flex-col items-center gap-1.5 pt-1">
                        {showWelcomeReplyButton ? (
                          <button
                            type="button"
                            disabled={syncing}
                            onClick={() => void sendWelcomeSticker()}
                            className="group relative inline-flex h-9 items-center justify-center rounded-full border border-white/10 px-4.5 text-[13px] font-medium text-white/90 shadow-[0_10px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[16px] transition-all duration-200 hover:scale-[1.02] hover:bg-white/[0.09] hover:text-white hover:border-white/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                            style={composerInputThemeStyle}
                            aria-label={t("Отправить приветствие")}
                          >
                            <span className="relative z-10 flex items-center gap-1.5">
                              <span>{t("Отправить приветствие")}</span>
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : parsed.kind === "album" ? (
                    <div
                      className={`relative transition-[background-color,color,opacity] duration-150 ease-out ${parsed.caption || replyPreviewBlock
                        ? isMine
                          ? mineMessageClassName
                          : incomingMessageClassName
                        : "bg-transparent shadow-none ring-0"
                        } ${dissolveTargetClass} ${parsed.caption || replyPreviewBlock ? stackedBubbleShapeClass : stackedMediaShapeClass} ${!parsed.caption && reactions.length > 0 ? "mb-8" : ""} w-[min(82vw,360px)] md:w-[340px] lg:w-[360px]`}
                      style={isMine && (parsed.caption || replyPreviewBlock) ? mineMessageGradientStyle : undefined}
                    >
                      {parsed.caption || replyPreviewBlock ? (
                        parsed.caption ? <MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineMessageGradientStyle} /> : <MediaMessageTail isMine={isMine} hasTail={hasTail} />
                      ) : null}
                      <div className="relative z-[2] overflow-hidden rounded-[inherit]">
                        {replyPreviewBlock}
                        <div className={`relative overflow-hidden rounded-t-[inherit] ${albumGridContainerClass(parsed.items.length)}`}>
                          {parsed.items.map((item, mediaIndex) => (
                            <button
                              data-album-media
                              key={`${item.src}-${mediaIndex}`}
                              type="button"
                              className={`relative block overflow-hidden ${albumGridItemClass(parsed.items.length, mediaIndex)}`}
                              onClick={() => {
                                if (item.kind === "video") {
                                  setVideoViewer({
                                    src: rawParsed.kind === "album" ? rawParsed.items[mediaIndex]?.src ?? item.src : item.src,
                                    caption: parsed.caption || "",
                                    timeText,
                                    dateText: formatMediaViewerDate(message.createdAt),
                                    messageId: message.id,
                                    authorName: mediaViewerAuthorName,
                                    authorAvatarUrl: mediaViewerAuthorAvatarUrl,
                                    authorLink: mediaViewerAuthorLink,
                                    canDelete: rawIsMine || canModerateGroupMessages || canModerateChannelMessages,
                                    isMine: isMine || rawIsMine,
                                  });
                                  setVideoViewerFailed(false);
                                  setVideoViewerPlaying(true);
                                  return;
                                }
                                openImageViewer({
                                  src: rawParsed.kind === "album" ? rawParsed.items[mediaIndex]?.src ?? item.src : item.src,
                                  caption: parsed.caption || "",
                                  timeText,
                                  dateText: formatMediaViewerDate(message.createdAt),
                                  messageId: message.id,
                                  authorName: mediaViewerAuthorName,
                                  authorAvatarUrl: mediaViewerAuthorAvatarUrl,
                                  authorLink: mediaViewerAuthorLink,
                                  canDelete: rawIsMine || canModerateGroupMessages || canModerateChannelMessages,
                                  isMine: isMine || rawIsMine,
                                });
                              }}
                            >
                              {item.kind === "video" ? (
                                <>
                                  <ChatVideoThumb
                                    fill
                                    src={item.src} preview={item.preview}
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute left-2 top-2 rounded-md bg-black/60 p-1 text-white">
                                    <SquarePlay size={12} />
                                  </span>
                                </>
                              ) : (
                                <ChatImageThumb
                                  fill
                                  src={item.src} preview={item.preview}
                                  alt={t("Изображение")}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </button>
                          ))}
                          {!parsed.caption ? (
                            <div className={`pointer-events-none absolute bottom-3 ${isMine ? "right-3" : "left-3"}`}>
                              {renderBubbleMeta({
                                timeText,
                                showChannelViews,
                                channelViewsText,
                                showDeliveryStatus,
                                isRead,
                                pendingLabel,
                                overlay: true,
                              })}
                            </div>
                          ) : null}
                        </div>
                        {parsed.caption ? (
                          <div className="px-3 pb-2 pt-2">
                            {reactions.length > 0 ? (
                              <>
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                  <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                    {renderLinkifiedText(parsed.caption)}
                                  </p>
                                </div>
                                <div className="flex items-end justify-between gap-2 mt-1.5">
                                  <div className="min-w-0 flex-1">
                                    {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                                  </div>
                                  <div className="shrink-0">
                                    {renderBubbleMeta({
                                      timeText,
                                      showChannelViews,
                                      channelViewsText,
                                      showDeliveryStatus,
                                      isRead,
                                      pendingLabel,
                                    })}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                  {renderLinkifiedText(parsed.caption)}
                                </p>
                                <div className="shrink-0">
                                  {renderBubbleMeta({
                                    timeText,
                                    showChannelViews,
                                    channelViewsText,
                                    showDeliveryStatus,
                                    isRead,
                                    pendingLabel,
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {!parsed.caption && reactions.length > 0 ? <div className={`pointer-events-auto absolute bottom-[-29px] z-10 ${isMine ? "right-3" : "left-3"}`}>
                        {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: isMine ? "end" : "start", rtl: isMine, overlay: true })}
                      </div> : null}
                    </div>
                  ) : parsed.kind === "image" ? (
                    (parsed.caption || (forwardAuthor && !detachedForward)) ? (
                      <div
                        className={`relative transition-[background-color,color,opacity] duration-150 ease-out ${isMine
                          ? mineMessageClassName
                          : incomingMessageClassName
                          } ${dissolveTargetClass} ${stackedBubbleShapeClass} ${!parsed.caption && reactions.length > 0 ? "mb-8" : ""}`}
                        style={isMine ? mineMessageGradientStyle : undefined}
                      >
                        {parsed.caption ? <MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineMessageGradientStyle} /> : <MediaMessageTail isMine={isMine} hasTail={hasTail} />}
                        <div className="relative z-[2] overflow-hidden rounded-[inherit]">
                          {replyPreviewBlock}
                          <button
                            type="button"
                            onClick={() => {
                              openImageViewer({
                                src: "src" in rawParsed ? rawParsed.src : parsed.src,
                                caption: parsed.caption,
                                timeText,
                                dateText: formatMediaViewerDate(message.createdAt),
                                messageId: message.id,
                                authorName: mediaViewerAuthorName,
                                authorAvatarUrl: mediaViewerAuthorAvatarUrl,
                                authorLink: mediaViewerAuthorLink,
                                canDelete: isMine || canModerateGroupMessages,
                                isMine: isMine || rawIsMine,
                              });
                            }}
                            className="block w-full text-left cursor-zoom-in"
                            aria-label={t("Открыть изображение")}
                          >
                            <ChatImageThumb
                              src={parsed.src} preview={parsed.preview} aspectRatio={parsed.aspectRatio}
                              alt={t("Изображение")}
                              className="block max-h-[360px] max-w-[260px] md:max-w-[420px] object-contain bg-black"
                            />
                          </button>
                          {parsed.caption ? <div data-media-caption className="px-3 pb-2 pt-2">
                            {reactions.length > 0 ? (
                              <>
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                  <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                    {renderLinkifiedText(parsed.caption)}
                                  </p>
                                </div>
                                <div className="flex items-end justify-between gap-2 mt-1.5">
                                  <div className="min-w-0 flex-1">
                                    {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                                  </div>
                                  <div className="shrink-0">
                                    {renderBubbleMeta({
                                      timeText,
                                      showChannelViews,
                                      channelViewsText,
                                      showDeliveryStatus,
                                      isRead,
                                      pendingLabel,
                                    })}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                  {renderLinkifiedText(parsed.caption)}
                                </p>
                                <div className="shrink-0">
                                  {renderBubbleMeta({
                                    timeText,
                                    showChannelViews,
                                    channelViewsText,
                                    showDeliveryStatus,
                                    isRead,
                                    pendingLabel,
                                  })}
                                </div>
                              </div>
                            )}
                          </div> : <>
                            <div className={`pointer-events-none absolute bottom-3 ${isMine ? "right-3" : "left-3"}`}>
                              {renderBubbleMeta({ timeText, showChannelViews, channelViewsText, showDeliveryStatus, isRead, pendingLabel, overlay: true })}
                            </div>
                          </>}
                        </div>
                        {!parsed.caption && reactions.length > 0 ? <div className={`pointer-events-auto absolute bottom-[-29px] z-10 ${isMine ? "right-3" : "left-3"}`}>
                          {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: isMine ? "end" : "start", rtl: isMine, overlay: true })}
                        </div> : null}
                      </div>
                    ) : (
                      <div className={`relative flex flex-col gap-1.5 transition-opacity duration-75 message-bubble-target ${dissolveTargetClass}`}>
                        {replyPreviewBlock ? (
                          <div
                            className={`relative overflow-hidden ${isMine
                              ? mineMessageClassName
                              : incomingMessageClassName
                              } ${stackedBubbleShapeClass}`}
                            style={isMine ? mineMessageGradientStyle : undefined}
                          >
                            {replyPreviewBlock}
                          </div>
                        ) : null}
                        <div className={`relative w-fit ${isMine ? "ml-auto" : ""} ${reactions.length > 0 ? "mb-8" : ""}`}>
                          <button
                            type="button"
                            onClick={() => {
                              openImageViewer({
                                src: "src" in rawParsed ? rawParsed.src : parsed.src,
                                caption: parsed.caption,
                                timeText,
                                dateText: formatMediaViewerDate(message.createdAt),
                                messageId: message.id,
                                authorName: mediaViewerAuthorName,
                                authorAvatarUrl: mediaViewerAuthorAvatarUrl,
                                authorLink: mediaViewerAuthorLink,
                                canDelete: isMine || canModerateGroupMessages,
                                isMine: isMine || rawIsMine,
                              });
                            }}
                            className={`relative block overflow-hidden cursor-zoom-in text-left ${stackedMediaShapeClass}`}
                            aria-label={t("Открыть изображение")}
                          >
                            <ChatImageThumb
                              src={parsed.src} preview={parsed.preview} aspectRatio={parsed.aspectRatio}
                              alt={t("Изображение")}
                              className="block max-h-[360px] max-w-[260px] md:max-w-[420px] object-contain"
                            />
                            <div className={`pointer-events-none absolute bottom-3 ${isMine ? "right-3" : "left-3"}`}>
                              {renderBubbleMeta({
                                timeText,
                                showChannelViews,
                                channelViewsText,
                                showDeliveryStatus,
                                isRead,
                                pendingLabel,
                                overlay: true,
                              })}
                            </div>
                          </button>
                          {reactions.length > 0 ? (
                            <div className={`pointer-events-auto absolute bottom-[-29px] z-10 ${isMine ? "right-3" : "left-3"}`}>
                              {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: isMine ? "end" : "start", rtl: isMine, overlay: true })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  ) : parsed.kind === "poll" ? (
                    <ChatPoll
                      messageId={message.id}
                      question={parsed.question}
                      options={parsed.options}
                      quizMode={parsed.quizMode}
                      correctOptionIndex={parsed.correctOptionIndex}
                      expiresAt={parsed.expiresAt}
                      myVoteIndex={pollResults[message.id]?.userVotedOptionIdx ?? null}
                      totalVotes={pollResults[message.id]?.totalVotes ?? 0}
                      optionCounts={pollResults[message.id]?.optionCounts ?? {}}
                      isClosed={parsed.expiresAt ? new Date(parsed.expiresAt) < new Date() : false}
                      onVote={(optionIndex: number) => handlePollVote(message.id, optionIndex)}
                      onFetchResults={() => fetchPollResults(message.id)}
                      bubbleClassName={
                        isMine
                          ? mineMessageClassName
                          : incomingMessageClassName
                      }
                      bubbleStyle={isMine ? mineMessageGradientStyle : undefined}
                      stackedBubbleShapeClass={stackedBubbleShapeClass}
                      bubbleTailClass={bubbleTailClass}
                      tailSlot={<MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineMessageGradientStyle} />}
                      isRemoving={isRemoving}
                      replyPreviewBlock={replyPreviewBlock}
                      reactions={reactions}
                      renderInlineReactions={(align: "start" | "end") =>
                        reactions.length > 0 ? (
                          <div className="pointer-events-auto mt-1 select-none">
                            {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align, rtl: isMine })}
                          </div>
                        ) : null
                      }
                      renderBubbleMeta={(props) =>
                        renderBubbleMeta({
                          timeText,
                          showChannelViews,
                          channelViewsText,
                          showDeliveryStatus,
                          isRead,
                          pendingLabel,
                          ...props,
                        })
                      }
                      isMine={isMine}
                    />
                  ) : parsed.kind === "voice" ? (
                    <div
                      className={`relative flex flex-col gap-1.5 transition-opacity duration-75 message-bubble-target ${dissolveTargetClass}`}
                    >
                      <VoiceMessageBubble
                        headerSlot={replyPreviewBlock}
                        src={parsed.src}
                        authorName={
                          activeConversation?.chatType === "channel"
                            ? activeTitle || activeChat?.displayName || t("Канал")
                            : isMine
                              ? selfProfile?.displayName || selfProfile?.link || t("Я")
                              : activeConversation?.chatType === "direct"
                                ? activeTitle || activeChat?.displayName || t("Собеседник")
                                : senderName
                        }
                        durationMs={parsed.durationMs}
                        waveform={decodeWaveformFromMessage(parsed.waveform)}
                        timeText={timeText}
                        showDeliveryStatus={showDeliveryStatus}
                        isRead={isRead}
                        showChannelViews={showChannelViews}
                        channelViewsText={channelViewsText}
                        isMine={isMine}
                        mineGradientStyle={mineMessageGradientStyle}
                        bubbleClassName={stackedBubbleShapeClass}
                        reactionsSlot={renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                        hasTail={hasTail}
                      />
                    </div>
                  ) : parsed.kind === "video" ? (
                    parsed.mode === "file" ? (
                      (parsed.caption || (forwardAuthor && !detachedForward)) ? (
                        <div
                          className={`relative transition-[background-color,color,opacity] duration-150 ease-out ${isMine
                            ? mineMessageClassName
                            : incomingMessageClassName
                            } ${dissolveTargetClass} ${stackedBubbleShapeClass} ${!parsed.caption && reactions.length > 0 ? "mb-8" : ""}`}
                          style={isMine ? mineMessageGradientStyle : undefined}
                        >
                          {parsed.caption ? <MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineMessageGradientStyle} /> : <MediaMessageTail isMine={isMine} hasTail={hasTail} />}
                          <div className="relative z-[2] overflow-hidden rounded-[inherit]">
                            {replyPreviewBlock}
                            <button
                              type="button"
                              onClick={() => {
                                setVideoViewer({
                                  src: "src" in rawParsed ? rawParsed.src : parsed.src,
                                  caption: parsed.caption,
                                  timeText,
                                  dateText: formatMediaViewerDate(message.createdAt),
                                  messageId: message.id,
                                  authorName: mediaViewerAuthorName,
                                  authorAvatarUrl: mediaViewerAuthorAvatarUrl,
                                  authorLink: mediaViewerAuthorLink,
                                  canDelete: isMine || canModerateGroupMessages || canModerateChannelMessages,
                                  isMine: isMine || rawIsMine,
                                });
                                setVideoViewerFailed(false);
                                setVideoViewerPlaying(true);
                              }}
                              className="block w-full cursor-zoom-in text-left"
                              aria-label={t("Открыть видео")}
                            >
                              <ChatVideoThumb
                                src={parsed.src} preview={parsed.preview} aspectRatio={parsed.aspectRatio}
                                className="block max-h-[360px] max-w-[260px] md:max-w-[420px] object-contain bg-black"
                              />
                            </button>
                            {parsed.caption ? <div data-media-caption className="px-3 pb-2 pt-2">
                              {reactions.length > 0 ? (
                                <>
                                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-[5px]">
                                    <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                      {renderLinkifiedText(parsed.caption)}
                                    </p>
                                  </div>
                                  <div className="flex items-end justify-between gap-2 mt-1.5">
                                    <div className="min-w-0 flex-1">
                                      {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                                    </div>
                                    <div className="shrink-0">
                                      {renderBubbleMeta({
                                        timeText,
                                        showChannelViews,
                                        channelViewsText,
                                        showDeliveryStatus,
                                        isRead,
                                        pendingLabel,
                                      })}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-[5px]">
                                  <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                    {renderLinkifiedText(parsed.caption)}
                                  </p>
                                  <div className="shrink-0">
                                    {renderBubbleMeta({
                                      timeText,
                                      showChannelViews,
                                      channelViewsText,
                                      showDeliveryStatus,
                                      isRead,
                                      pendingLabel,
                                    })}
                                  </div>
                                </div>
                              )}
                            </div> : <>
                              <div className={`pointer-events-none absolute bottom-3 ${isMine ? "right-3" : "left-3"}`}>
                                {renderBubbleMeta({ timeText, showChannelViews, channelViewsText, showDeliveryStatus, isRead, pendingLabel, overlay: true })}
                              </div>
                            </>}
                          </div>
                          {!parsed.caption && reactions.length > 0 ? <div className={`pointer-events-auto absolute bottom-[-29px] z-10 ${isMine ? "right-3" : "left-3"}`}>
                            {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: isMine ? "end" : "start", rtl: isMine, overlay: true })}
                          </div> : null}
                        </div>
                      ) : (
                        <div className={`relative flex flex-col gap-1.5 transition-opacity duration-75 message-bubble-target ${dissolveTargetClass}`}>
                          {replyPreviewBlock ? (
                            <div
                              className={`relative overflow-hidden ${isMine
                                ? mineMessageClassName
                                : incomingMessageClassName
                                } ${stackedBubbleShapeClass}`}
                              style={isMine ? mineMessageGradientStyle : undefined}
                            >
                              {replyPreviewBlock}
                            </div>
                          ) : null}
                          <div className={`relative w-fit ${isMine ? "ml-auto" : ""} ${reactions.length > 0 ? "mb-8" : ""}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setVideoViewer({
                                  src: "src" in rawParsed ? rawParsed.src : parsed.src,
                                  caption: parsed.caption,
                                  timeText,
                                  dateText: formatMediaViewerDate(message.createdAt),
                                  messageId: message.id,
                                  authorName: mediaViewerAuthorName,
                                  authorAvatarUrl: mediaViewerAuthorAvatarUrl,
                                  authorLink: mediaViewerAuthorLink,
                                  canDelete: isMine || canModerateGroupMessages || canModerateChannelMessages,
                                  isMine: isMine || rawIsMine,
                                });
                                setVideoViewerFailed(false);
                                setVideoViewerPlaying(true);
                              }}
                              className={`relative block overflow-hidden cursor-zoom-in text-left ${stackedMediaShapeClass}`}
                              aria-label={t("Открыть видео")}
                            >
                              <ChatVideoThumb
                                src={parsed.src} preview={parsed.preview} aspectRatio={parsed.aspectRatio}
                                className="block max-h-[360px] max-w-[260px] bg-black md:max-w-[420px] object-contain"
                              />
                              <div className={`pointer-events-none absolute bottom-3 ${isMine ? "right-3" : "left-3"}`}>
                                {renderBubbleMeta({
                                  timeText,
                                  showChannelViews,
                                  channelViewsText,
                                  showDeliveryStatus,
                                  isRead,
                                  pendingLabel,
                                  overlay: true,
                                })}
                              </div>
                            </button>
                            {reactions.length > 0 ? (
                              <div className={`pointer-events-auto absolute bottom-[-29px] z-10 ${isMine ? "right-3" : "left-3"}`}>
                                {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: isMine ? "end" : "start", rtl: isMine, overlay: true })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className={`flex flex-col gap-1.5 ${isMine ? "items-end pr-1 sm:pr-2" : "items-start pl-1 sm:pl-2"}`}>
                        <div
                          className={`relative transition-opacity duration-75 message-bubble-target ${dissolveTargetClass} ${reactions.length > 0 ? "mb-7" : ""} ${forwardAuthor && !detachedForward ? `${isMine ? mineMessageClassName : incomingMessageClassName} ${stackedBubbleShapeClass} p-3` : ""}`}
                          style={forwardAuthor && !detachedForward && isMine ? mineMessageGradientStyle : undefined}
                        >
                          {forwardHeader}
                          <VideoCircleBubble
                            src={parsed.src} preview={parsed.preview}
                            durationMs={parsed.durationMs}
                            timeText={timeText}
                            showDeliveryStatus={showDeliveryStatus}
                            isRead={isRead}
                            showChannelViews={showChannelViews}
                            channelViewsText={channelViewsText}
                            isMine={isMine}
                            reactionsSlot={
                              reactions.length > 0
                                ? renderInlineReactions(message.id, reactions, isMine, {
                                  noTopMargin: true,
                                  align: isMine ? "end" : "start",
                                  rtl: isMine,
                                  overlay: true,
                                })
                                : null
                            }
                          />
                        </div>
                      </div>
                    )
                  ) : parsed.kind === "music" ? (
                    <div
                      className={`relative transition-opacity duration-75 message-bubble-target ${dissolveTargetClass}`}
                    >
                      <MusicMessageBubble
                        headerSlot={replyPreviewBlock}
                        url={parsed.url}
                        title={parsed.title}
                        author={parsed.author}
                        coverUrl={parsed.coverUrl}
                        caption={parsed.caption}
                        durationMs={parsed.durationMs}
                        timeText={timeText}
                        showDeliveryStatus={showDeliveryStatus}
                        isRead={isRead}
                        showChannelViews={showChannelViews}
                        channelViewsText={channelViewsText}
                        isMine={isMine}
                        mineGradientStyle={mineMessageGradientStyle}
                        bubbleClassName={stackedBubbleShapeClass}
                        reactionsSlot={renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                        hasTail={hasTail}
                      />
                    </div>
                  ) : parsed.kind === "file" ? (
                    <div
                      className={`relative w-[min(78vw,320px)] px-2.5 py-2 transition-colors duration-150 ease-out md:w-[420px] md:max-w-[54vw] ${isMine
                        ? mineMessageClassName
                        : incomingMessageClassName
                        } message-bubble-target ${dissolveTargetClass} ${stackedBubbleShapeClass}`}
                      style={isMine ? mineMessageGradientStyle : undefined}
                    >
                      <MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineMessageGradientStyle} />
                      <div className="relative z-[2] space-y-2">
                        {replyPreviewBlock}
                        <a
                          href={parsed.src}
                          target="_blank"
                          rel="noreferrer noopener"
                          download={parsed.name}
                          className={`group flex w-full items-center gap-2 rounded-2xl px-0.5 py-0.5 text-left transition ${isMine
                            ? "hover:bg-white/8"
                            : "hover:bg-white/5"
                            }`}
                        >
                          {(() => {
                            const ext = (parsed.name?.includes(".") ? parsed.name.split(".").pop()?.toLowerCase() : "") || (parsed.mimeType ? parsed.mimeType.split("/").pop()?.toLowerCase() : "file") || "file";
                            const isAudio = ext === "mp3" || ext === "wav" || ext === "m4a" || ext === "ogg" || ext === "flac" || ext === "aac" || ext === "opus";
                            const isPdf = ext === "pdf";
                            const isApk = ext === "apk";
                            const isDoc = ext === "doc" || ext === "docx" || ext === "txt" || ext === "rtf";
                            const isZip = ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz";
                            const badgeColor = isAudio
                              ? "bg-zinc-950 text-white"
                              : isPdf
                                ? "bg-red-500 text-white"
                                : isApk
                                  ? "bg-emerald-500 text-white"
                                  : isDoc
                                    ? "bg-blue-500 text-white"
                                    : isZip
                                      ? "bg-amber-500 text-white"
                                      : "bg-indigo-500 text-white";

                            return (
                              <div
                                className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[12px] font-bold uppercase tracking-wider shadow-sm overflow-hidden ${badgeColor}`}
                              >
                                <span className="transition-opacity duration-200 group-hover:opacity-0">
                                  {ext.slice(0, 4)}
                                </span>
                                <Download size={20} className="absolute inset-0 m-auto text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm" />
                              </div>
                            );
                          })()}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">{parsed.name}</p>
                            {parsed.caption ? (
                              <p
                                className="mt-0.5 truncate font-sans text-[11px] font-medium leading-4 tabular-nums text-current"
                              >
                                {formatFileSize(parsed.size)}
                              </p>
                            ) : (
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p
                                  className="min-w-0 truncate font-sans text-[11px] font-medium leading-4 tabular-nums text-current"
                                >
                                  {formatFileSize(parsed.size)}
                                </p>
                                {reactions.length === 0 ? (
                                  <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={`shrink-0 flex items-center gap-1 ${isMine
                                    ? mineMessageGradientStyle
                                      ? "text-white/90"
                                      : "text-zinc-500"
                                    : "text-zinc-500 dark:text-zinc-400"
                                    }`} />
                                ) : null}
                              </div>
                            )}
                          </div>
                        </a>
                        {(parsed.caption || (forwardAuthor && !detachedForward)) ? (
                          <div className="space-y-1">
                            {reactions.length > 0 ? (
                              <>
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                  <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                    {renderLinkifiedText(parsed.caption)}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <div className="min-w-0 flex-1">
                                    {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                                  </div>
                                  <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={`translate-y-1 shrink-0 inline-flex items-center gap-[3px] leading-none select-none ${isMine
                                    ? mineMessageGradientStyle
                                      ? "text-white/90"
                                      : "text-zinc-500"
                                    : "text-zinc-500 dark:text-zinc-400"
                                    }`} />
                                </div>
                              </>
                            ) : (
                              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                <p className={`min-w-0 text-sm leading-relaxed ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                  {renderLinkifiedText(parsed.caption)}
                                </p>
                                <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={`translate-y-1 shrink-0 inline-flex items-center gap-[3px] leading-none select-none ${isMine
                                  ? mineMessageGradientStyle
                                    ? "text-white/90"
                                    : "text-zinc-500"
                                  : "text-zinc-500 dark:text-zinc-400"
                                  }`} />
                              </div>
                            )}
                          </div>
                        ) : (
                          reactions.length > 0 ? (
                            <div className="flex items-center justify-between gap-2 mt-1.5 w-full">
                              <div className="min-w-0 flex-1">
                                {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                              </div>
                              <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={`translate-y-1 shrink-0 inline-flex items-center gap-[3px] leading-none select-none text-[11px] ${isMine
                                ? mineMessageGradientStyle
                                  ? "text-white/90"
                                  : "text-zinc-500"
                                : "text-zinc-500 dark:text-zinc-400"
                                }`} />
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "relative transition-[background-color,color,opacity] duration-150 ease-out",
                        isMine ? "pl-3 pr-2 py-1.5" : "pl-2.5 pr-2.5 py-1.5",
                        "message-bubble-target", dissolveTargetClass,
                        stackedBubbleShapeClass,
                        isMine
                          ? mineMessageClassName
                          : incomingMessageClassName
                      )}
                      style={isMine ? mineMessageGradientStyle : undefined}
                    >
                      <MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineMessageGradientStyle} />
                      <div className="relative z-[2] space-y-1">
                        {replyPreviewBlock}
                        {reactions.length > 0 ? (
                          <>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                              <p className={`min-w-0 text-[15px] leading-[1.34] ${MESSAGE_TEXT_WRAP_CLASS}`}>
                                {renderLinkifiedText(parsed.text)}
                              </p>
                            </div>
                            <div className="flex items-end justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                {renderInlineReactions(message.id, reactions, isMine, { noTopMargin: true, align: "start" })}
                              </div>
                              <div className="shrink-0 inline-flex items-center gap-[3px] leading-none opacity-75 select-none">
                                {showChannelViews ? (
                                  <span className="inline-flex items-center gap-0.5 mr-1 text-[11px] leading-none">
                                    <IoMdEye size={12} />
                                    {channelViewsText}
                                  </span>
                                ) : null}
                                <span className="text-[11px] leading-none">{timeText}</span>
                                {showDeliveryStatus ? <MessageStatusTicks read={isRead} /> : null}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-[5px]">
                            <p className={`min-w-0 text-[15px] leading-[1.34] ${MESSAGE_TEXT_WRAP_CLASS}`}>
                              {renderLinkifiedText(parsed.text)}
                            </p>
                            <div className="shrink-0 inline-flex items-center gap-[3px] leading-none opacity-75 select-none">
                              {showChannelViews ? (
                                <span className="inline-flex items-center gap-0.5 mr-1 text-[11px] leading-none">
                                  <IoMdEye size={12} />
                                  {channelViewsText}
                                </span>
                              ) : null}
                              <span className="text-[11px] leading-none">{timeText}</span>
                              {showDeliveryStatus ? <MessageStatusTicks read={isRead} /> : null}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </MediaReplyLayout>

                {message.sendFailure && rawIsMine && <FailedMessageBadge isMine={isMine} onClick={() => setMessageHelperId(message.id)} />}
                </MessageHelperPreviewSource>

                {isManagedBotConversation && message.botReplyMarkup && activeChat?.link ? (
                  <BotInlineKeyboard markup={message.botReplyMarkup} messageId={message.id} link={activeChat.link} />
                ) : null}

                {isDesktop && !message.pending && !message.sendFailure && !selectionMode && !isSecretChat && messageHelperId !== message.id && (
                  <AnimatePresence>
                    {!isSecretChat && hasAllowedReactions && hoverReactionMessageId === message.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.6, y: 6 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        onMouseEnter={() => {
                          if (hoverReactionLeaveTimerRef.current) {
                            clearTimeout(hoverReactionLeaveTimerRef.current);
                            hoverReactionLeaveTimerRef.current = null;
                          }
                          setHoverReactionExpandedMessageId(message.id);
                        }}
                        onMouseLeave={() => {
                          hoverReactionLeaveTimerRef.current = setTimeout(() => {
                            setHoverReactionMessageId(null);
                            setHoverReactionExpandedMessageId(null);
                          }, 260);
                        }}
                        className={cn(
                          "absolute bottom-1 z-30 pointer-events-auto select-none",
                          isMine
                            ? "right-full mr-2 before:absolute before:-right-2.5 before:inset-y-0 before:w-3"
                            : "left-full ml-2 before:absolute before:-left-2.5 before:inset-y-0 before:w-3"
                        )}
                      >
                        {hoverReactionExpandedMessageId === message.id ? (
                          <motion.div
                            initial={{ opacity: 0, height: 32, scaleY: 0.7 }}
                            animate={{ opacity: 1, height: "auto", scaleY: 1 }}
                            exit={{ opacity: 0, height: 32, scaleY: 0.7 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col-reverse items-center gap-0.5 max-h-[196px] w-[32px] overflow-y-auto no-scrollbar rounded-full border p-0.5 shadow-2xl origin-bottom"
                            style={composerInputThemeStyle}
                          >
                            {hoverReactionEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                data-reaction-button="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void toggleReaction(message.id, emoji);
                                  setHoverReactionMessageId(null);
                                  setHoverReactionExpandedMessageId(null);
                                }}
                                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[16px] leading-none transition-transform hover:scale-130 active:scale-95 cursor-pointer"
                                title={emoji}
                              >
                                {renderTextWithEmojis(emoji, { size: 17 })}
                              </button>
                            ))}
                          </motion.div>
                        ) : (
                          <button
                            type="button"
                            data-reaction-button="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (defaultQuickReaction) void toggleReaction(message.id, defaultQuickReaction);
                              setHoverReactionMessageId(null);
                              setHoverReactionExpandedMessageId(null);
                            }}
                            className="flex h-[28px] w-[28px] items-center justify-center rounded-full border shadow-xl transition-all duration-150 hover:scale-115 active:scale-90 cursor-pointer"
                            style={composerInputThemeStyle}
                            title={t("Быстрая реакция")}
                          >
                            {defaultQuickReaction && renderTextWithEmojis(defaultQuickReaction, { size: 16 })}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {shouldUseLegacyMessageHelper && messageHelperId === message.id && !isCoarsePointer ? (
              <motion.div
                initial={{
                  opacity: 0,
                  x:
                    messageHelperHorizontalPlacement === "outside-left"
                      ? 10
                      : messageHelperHorizontalPlacement === "outside-right"
                        ? -10
                        : 0,
                  y: 0,
                  scale: 0.96,
                }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x:
                    messageHelperHorizontalPlacement === "outside-left"
                      ? 8
                      : messageHelperHorizontalPlacement === "outside-right"
                        ? -8
                        : 0,
                  y: 0,
                  scale: 0.97,
                }}
                transition={{ type: "spring", stiffness: 440, damping: 28 }}
                className={`absolute z-50 flex flex-col transform-gpu ${messageHelperHorizontalPlacement === "outside-left"
                  ? "top-1/2 right-[calc(100%+10px)] -translate-y-1/2 items-end"
                  : "top-1/2 left-[calc(100%+10px)] -translate-y-1/2 items-start"
                  }`}
                style={{ willChange: "opacity, transform" }}
              >
                <motion.div
                  initial={{ opacity: 0, x: -24, clipPath: "inset(0% 100% 0% 0% round 18px)" }}
                  animate={{ opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0% round 18px)" }}
                  exit={{ opacity: 0, x: -16, clipPath: "inset(0% 100% 0% 0% round 18px)" }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                  data-message-helper="true"
                  className="mb-1.5 inline-flex items-center rounded-[18px] border p-1 shadow-[0_14px_40px_rgba(0,0,0,0.4)]"
                  style={{ ...composerInputThemeStyle, display: isSecretChat || !hasAllowedReactions ? "none" : undefined }}
                >
                  <div className="flex items-center gap-0.5 px-0.5">
                    {helperReactionEmojis.map((emoji) => (
                      <motion.button
                        key={`${message.id}-${emoji}`}
                        type="button"
                        data-reaction-button="true"
                        onClick={() => {
                          void toggleReaction(message.id, emoji);
                          setMessageHelperId(null);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[19px] leading-none text-white transition hover:bg-white/10"
                        whileTap={{ scale: 0.88 }}
                        whileHover={{ scale: 1.18 }}
                      >
                        {renderTextWithEmojis(emoji)}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
                <div
                  data-message-helper="true"
                  className="min-w-[176px] rounded-xl border border-zinc-200/70 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-950/96 text-zinc-800 dark:text-zinc-100 p-1.5 shadow-xl dark:shadow-2xl backdrop-blur-md flex flex-col"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStoryReplyTarget(null);
                      setReplyToMessageId(message.id);
                      setMessageHelperId(null);
                    }}
                    className="h-9 w-full justify-start px-2.5 gap-2 text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                  >
                    <FaReply size={15} />
                    {t("Ответить")}</Button>
                  {!callMessage && !(!messagePins.canManage || messagePins.busy || message.id.startsWith("optimistic:")) && (<Button type="button" variant="ghost" size="sm" disabled={!messagePins.canManage || messagePins.busy || message.id.startsWith("optimistic:")} onClick={() => { setMessageHelperId(null); void messagePins.toggle((message).id); }} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><BsPinAngleFill size={17} className="shrink-0" />{messagePins.pins.some(pin => pin.id === (message).id) ? t("Открепить") : t("Закрепить")}</Button>)}
                  {!callMessage && parsed.kind !== "poll" && !(Boolean(selectedLink?.startsWith("secret-"))) && (<Button type="button" variant="ghost" size="sm" disabled={Boolean(selectedLink?.startsWith("secret-"))} onClick={() => beginForwardMessages([message])} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><IoArrowRedo size={17} />{t("Переслать")}</Button>)}
                  {!(!isEditable || editSaving || (editTarget ? editTarget.id !== message.id : false)) && (<Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      !isEditable || editSaving || (editTarget ? editTarget.id !== message.id : false)
                    }
                    onClick={() => beginEditMessage(message, parsed)}
                    className="h-9 w-full justify-start px-2.5 gap-2 text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50"
                  >
                    <MdEdit size={16} />
                    {t("Редактировать")}</Button>)}
                  {!callMessage && parsed.kind !== "poll" && !(parsed.kind === "image"
                    ? !parsed.caption.trim()
                      : parsed.kind === "album"
                        ? !parsed.caption.trim()
                        : parsed.kind === "sticker"
                          ? true
                          : parsed.kind === "voice" || parsed.kind === "video"
                            ? true
                            : parsed.kind === "file"
                              ? !(parsed.caption || parsed.name).trim()
                              : parsed.kind === "music"
                                ? !(parsed.caption || parsed.title).trim()
                                : !parsed.text.trim()) && (<Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    parsed.kind === "image"
                                      ? !parsed.caption.trim()
                                        : parsed.kind === "album"
                                          ? !parsed.caption.trim()
                                          : parsed.kind === "sticker"
                                            ? true
                                            : parsed.kind === "voice" || parsed.kind === "video"
                                              ? true
                                              : parsed.kind === "file"
                                                ? !(parsed.caption || parsed.name).trim()
                                                : parsed.kind === "music"
                                                  ? !(parsed.caption || parsed.title).trim()
                                                  : !parsed.text.trim()
                                  }
                                  onClick={() =>
                                    void copyMessageText(
                                      parsed.kind === "image"
                                        ? parsed.caption
                                          : parsed.kind === "album"
                                            ? parsed.caption
                                            : parsed.kind === "sticker"
                                              ? ""
                                              : parsed.kind === "voice" || parsed.kind === "video"
                                                ? ""
                                                : parsed.kind === "file"
                                                  ? (parsed.caption || parsed.name)
                                                  : parsed.kind === "music"
                                                    ? (parsed.caption || parsed.title)
                                                    : parsed.text,
                                    )
                                  }
                                  className="h-9 w-full justify-start px-2.5 gap-2 text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                                >
                                  <IoCopy size={15} />
                                  {t("Копировать")}</Button>)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => beginSelectionMode(message.id)}
                    className="h-9 w-full justify-start px-2.5 gap-2 text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                  >
                    <GrRadialSelected size={15} />
                    {t("Выбрать")}</Button>
                  {!(deletingMessageId === message.id ||
                    (activeConversation?.chatType === "group"
                      ? !isMine && !canModerateGroupMessages
                      : !isMine)) && (<Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          deletingMessageId === message.id ||
                          (activeConversation?.chatType === "group"
                            ? !isMine && !canModerateGroupMessages
                            : !isMine)
                        }
                        onClick={() => void deleteMessage(message.id)}
                        className="h-9 w-full justify-start px-2.5 gap-2 text-red-600 dark:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-200"
                      >
                        <MdDelete size={17} />
                        {deletingMessageId === message.id ? t("Удаление...") : t("Удалить")}
                      </Button>)}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  </>
);

}, (previous, next) => areMessageRowPropsEqual(previous, next, SHARED_ROW_PROPS));
