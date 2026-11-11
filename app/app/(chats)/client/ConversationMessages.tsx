"use client";
import type { MessageDeletionShift } from "./message-deletion-layout";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type BotChatSettings } from "@/lib/bot-chat-settings";
import { type DecryptedMessage, type SelfProfile, type ConversationResponse, type ChatSummary, type ChannelModalData, type GroupMember, type ProfileBatchItem, type ChatUiSettings, type ReactionSummary, type ChatImageGalleryItem, type StoryReplyTarget, type EditTarget, type ParsedMessageContent } from "../types";

import { IoCloudyNight } from "react-icons/io5";

import { CSSProperties, ReactNode, UIEvent, memo } from "react";

import { useMessagePins } from "../hooks/useMessagePins";

import { useCalls } from "../hooks/useCalls";

import { cn } from "@/lib/utils";

import { type ForwardAuthor } from "@/lib/client/message-forwarding";

import { LottieSticker } from "./legacy-stickers";

export interface ConversationMessagesProps {
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  handleMessagesScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  interruptMessageAutoScroll: () => void;
  messagesTouchYRef: React.RefObject<number | null>;
  isSecretChat: boolean;
  globalMusicVisible: boolean;
  messagePins: Pick<ReturnType<typeof useMessagePins>, "active" | "canManage" | "busy" | "toggle" | "pins">;
  selectionMode: boolean;
  showDirectEmptyState: boolean;
  isDesktop: boolean;
  stickerPickerOpen: boolean;
  mobileEmojiPickerHeight: number;
  footerHeight: number;
  emptyChatPanelThemeStyle: React.CSSProperties;
  isSecretChatCreator: boolean;
  t: (source: string, values?: TranslationValues | undefined) => string;
  activeTitle: string;
  isManagedBotConversation: boolean;
  botEmptyText: BotChatSettings["empty_text"];
  isSavedConversation: boolean;
  syncing: boolean;
  sendWelcomeSticker: () => Promise<void>;
  messagesCanvasHeight: number;
  bannersHeight: number;
  messageVerticalOffset: number;
  renderCommunityBanners: () => React.JSX.Element | null;
  renderedMessages: { message: DecryptedMessage; index: number; top: number; chainWithPrevious: boolean; chainWithNext: boolean; showDateSeparator: boolean; rowSpacingClassName: string; }[];
  selfId: string | null;
  selfProfile: SelfProfile | null;
  currentUserIdRef: React.RefObject<string | null>;
  activeConversation: ConversationResponse | null;
  getMessageRowRef: (messageId: string, messageLocalId?: string | null | undefined) => (node: HTMLDivElement | null) => void;
  dateSeparatorThemeStyle: React.CSSProperties;
  mineMessageClassName: "text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.04]" | "bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.18)]";
  incomingMessageClassName: "bg-[var(--incoming-message-background,#212121)] text-[color:var(--incoming-message-text,#fafafa)] shadow-[0_1px_2px_rgba(0,0,0,0.24)] border-0";
  mineMessageGradientStyle: React.CSSProperties | undefined;
  calls: Pick<ReturnType<typeof useCalls>, "enabled" | "busy" | "start"> & { current: boolean };
  activeChat: ChatSummary | null;
  handleApplyPeerWallpaper: (url: string, posY?: number | undefined) => Promise<void>;
  applyingWallpaper: boolean;
  channelModalData: ChannelModalData | null;
  removingMessageIds: Set<string>;
  groupMembersById: Map<string, GroupMember>;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  selectedLink: string | null;
  messages: DecryptedMessage[];
  hasComposerText: boolean;
  hasPendingImage: boolean;
  hasPendingVideo: boolean;
  hasPendingAudio: boolean;
  hasSentWelcomeSticker: boolean;
  readMessageIds: Set<string>;
  activeReadReceiptIso: string | undefined;
  replyMessageById: Map<string, DecryptedMessage>;
  mineReplyPreviewThemeStyle: React.CSSProperties | undefined;
  scrollToMessageById: (messageId: string, highlightDurationMs?: number) => void;
  openForwardAuthorProfile: (author: ForwardAuthor) => void;
  selectedMessageIdSet: Set<string>;
  chatUiSettings: ChatUiSettings;
  suppressMessageEntranceRef: React.RefObject<boolean>;
  animatedMessageIdsRef: React.RefObject<Set<string>>;
  deletingShift: MessageDeletionShift | null;
  messageHelperId: string | null;
  toggleMessageSelection: (messageId: string) => void;
  hoverReactionLeaveTimerRef: React.RefObject<NodeJS.Timeout | null>;
  hoverReactionTimerRef: React.RefObject<NodeJS.Timeout | null>;
  setHoverReactionMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoverReactionExpandedMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  highlightedMessageId: string | null;
  swipeMessageId: string | null;
  swipeOffsetX: number;
  isCoarsePointer: boolean;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  beginMessageSwipe: (event: React.TouchEvent<HTMLDivElement>, message: DecryptedMessage, isMine: boolean) => void;
  messageLongPressStartRef: React.RefObject<{ x: number; y: number; } | null>;
  clearMessageLongPress: () => void;
  moveMessageSwipe: (event: React.TouchEvent<HTMLDivElement>) => void;
  endMessageSwipe: (message: DecryptedMessage) => void;
  messageLongPressTriggeredRef: React.RefObject<boolean>;
  lastTapRef: React.RefObject<{ id: string; at: number; } | null>;
  messageSwipeStartRef: React.RefObject<{ id: string; x: number; y: number; isMine: boolean; } | null>;
  setSwipeMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setSwipeOffsetX: React.Dispatch<React.SetStateAction<number>>;
  messageLongPressTimerRef: React.RefObject<number | null>;
  renderInlineReactions: (messageId: string, reactions: ReactionSummary[], isMine: boolean, options?: { rtl?: boolean | undefined; noTopMargin?: boolean | undefined; align?: "auto" | "end" | "start" | undefined; overlay?: boolean | undefined; } | undefined) => React.JSX.Element | null;
  composerInputThemeStyle: React.CSSProperties;
  setVideoViewer: React.Dispatch<React.SetStateAction<{ src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null>>;
  setVideoViewerFailed: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoViewerPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  openImageViewer: (item: ChatImageGalleryItem) => void;
  renderLinkifiedText: (value: string) => React.ReactNode;
  pollResults: Record<string, { totalVotes: number; optionCounts: Record<number, number>; userVotedOptionIdx: number | null; }>;
  handlePollVote: (messageId: string, optionIdx: number) => Promise<void>;
  fetchPollResults: (messageId: string) => Promise<void>;
  hasAllowedReactions: boolean;
  hoverReactionMessageId: string | null;
  hoverReactionExpandedMessageId: string | null;
  hoverReactionEmojis: string[];
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  defaultQuickReaction: string;
  shouldUseLegacyMessageHelper: false;
  messageHelperHorizontalPlacement: "outside-left" | "outside-right";
  helperReactionEmojis: string[];
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  beginForwardMessages: (source: DecryptedMessage[]) => void;
  editSaving: boolean;
  editTarget: EditTarget | null;
  beginEditMessage: (message: DecryptedMessage, parsed: ParsedMessageContent) => void;
  copyMessageText: (value: string) => Promise<void>;
  beginSelectionMode: (messageId: string) => void;
  deletingMessageId: string | null;
  deleteMessage: (messageId: string) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

import { ConversationMessageRow } from "./ConversationMessageRow";
import { ConversationMessagePosition } from "./ConversationMessagePosition";

export const ConversationMessages = memo(function ConversationMessages(props: ConversationMessagesProps) {
  const { messagesViewportRef, handleMessagesScroll, interruptMessageAutoScroll, messagesTouchYRef, isSecretChat, globalMusicVisible, messagePins, selectionMode, showDirectEmptyState, isDesktop, stickerPickerOpen, mobileEmojiPickerHeight, footerHeight, emptyChatPanelThemeStyle, isSecretChatCreator, t, activeTitle, isManagedBotConversation, botEmptyText, isSavedConversation, syncing, sendWelcomeSticker, messagesCanvasHeight, bannersHeight, messageVerticalOffset, renderCommunityBanners, renderedMessages, setMessageHelperId, messagesEndRef } = props;
  return (
    <div
      ref={messagesViewportRef}
      onScroll={handleMessagesScroll}
      onWheel={event => {
        if (event.deltaY < 0 && event.currentTarget.scrollTop > 0) interruptMessageAutoScroll();
      }}
      onPointerDown={event => {
        const viewport = event.currentTarget;
        const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
        if (event.pointerType === "mouse" && scrollbarWidth > 0 && event.clientX >= viewport.getBoundingClientRect().right - scrollbarWidth) interruptMessageAutoScroll();
      }}
      onTouchStart={event => { messagesTouchYRef.current = event.touches[0]?.clientY ?? null; }}
      onTouchMove={event => {
        const y = event.touches[0]?.clientY;
        if (y !== undefined && messagesTouchYRef.current !== null) {
          if (y > messagesTouchYRef.current + 2 && event.currentTarget.scrollTop > 0) interruptMessageAutoScroll();
        }
        if (y !== undefined) messagesTouchYRef.current = y;
      }}
      onTouchEnd={() => { messagesTouchYRef.current = null; }}
      onKeyDown={event => {
        if (event.currentTarget.scrollTop > 0 && (["ArrowUp", "PageUp", "Home"].includes(event.key) || (event.key === " " && event.shiftKey))) interruptMessageAutoScroll();
      }}
      data-chat-message-viewport
      className={cn(
        "relative isolate z-0 flex-1 min-h-0 overflow-y-auto no-scrollbar overflow-x-hidden px-2.5 py-3 md:px-6 md:py-4 lg:px-7",
        isSecretChat
          ? globalMusicVisible
            ? "pt-[165px] md:pt-[160px]"
            : "pt-[115px] md:pt-[110px]"
          : globalMusicVisible
            ? "pt-[110px] md:pt-[105px]"
            : ""
      )}
      style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", overflowAnchor: "none", ...(messagePins.active && !selectionMode ? { paddingTop: (isSecretChat ? (globalMusicVisible ? 165 : 115) : globalMusicVisible ? 110 : 64) + 50 + (globalMusicVisible ? 8 : 0) } : {}) }}
    >
      <div
        className={`mx-auto w-full min-h-full flex flex-col gap-2.5 ${showDirectEmptyState ? "justify-center" : "justify-end"
          }`}
        style={{
          paddingBottom: !isDesktop && stickerPickerOpen
            ? `${mobileEmojiPickerHeight + 80}px`
            : `${footerHeight}px`,
        }}
      >
        {showDirectEmptyState && (
          <div className="flex min-h-full items-center justify-center p-4">
            {isSecretChat ? (
              <div
                className="flex w-full max-w-[292px] flex-col items-center rounded-[30px] border bg-transparent px-5 py-5 text-center text-zinc-100 md:max-w-[310px]"
                style={emptyChatPanelThemeStyle}
              >
                <p className="text-[17px] font-semibold leading-tight text-zinc-100">
                  {isSecretChatCreator
                    ? t("Вы пригласили {0} в секретный чат.", { 0: activeTitle })
                    : t("{0} пригласил(а) вас в секретный чат.", { 0: activeTitle })}
                </p>
                <div className="mt-3.5 w-full text-left space-y-2 text-[13px] text-zinc-300">
                  <p className="font-semibold text-zinc-200 text-[13px]">{t("Секретные чаты — это:")}</p>
                  <ul className="space-y-1.5 text-zinc-300/85">
                    <li className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400">•</span>
                      <span>{t("Ключи чата остаются на устройствах участников")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400">•</span>
                      <span>{t("Удаление переписки по таймеру")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400">•</span>
                      <span>{t("Содержимое сообщений зашифровано")}</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : isManagedBotConversation ? (
              botEmptyText ? <div className="max-w-[min(90%,420px)] whitespace-pre-wrap break-words rounded-[16px] border px-4 py-2 text-center text-[13px] font-medium text-zinc-300" style={emptyChatPanelThemeStyle}>
                {botEmptyText}
              </div> : null
            ) : (
              <div
                className="flex w-full max-w-[292px] flex-col items-center rounded-[30px] border bg-transparent px-5 py-5 text-center text-zinc-100 md:max-w-[310px]"
                style={emptyChatPanelThemeStyle}
              >
                {isSavedConversation ? (
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-transparent text-zinc-200">
                    <IoCloudyNight size={25} aria-hidden />
                  </div>
                ) : null}
                <p className={cn("text-[18px] font-semibold leading-tight text-zinc-100", isSavedConversation ? "mt-3" : "")}>
                  {isSavedConversation ? t("Ваше облачное хранилище") : t("Начните общение")}
                </p>
                <p className="mt-1.5 max-w-[230px] text-[13px] font-medium leading-5 text-zinc-300/86">
                  {isSavedConversation
                    ? t("Сохраняйте здесь сообщения, медиа и файлы размером до 100 МБ.")
                    : t("Отправьте первое сообщение или приветственный стикер.")}
                </p>
                {!isSavedConversation ? (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void sendWelcomeSticker()}
                    className="mt-2 flex h-[136px] w-full items-center justify-center rounded-[22px] bg-transparent transition-transform hover:scale-[1.015] active:scale-[0.985] disabled:opacity-60"
                    aria-label={t("Отправить приветственный стикер")}
                  >
                    <LottieSticker src="/stickers/tg-duck-greeting.tgs" className="h-[124px] w-[124px] drop-shadow-[0_14px_26px_rgba(0,0,0,0.24)]" />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}

        {!showDirectEmptyState && (
          <>
            <div data-chat-message-canvas className="relative mx-auto w-full md:max-w-[820px] lg:max-w-[860px]" style={{ height: `${messagesCanvasHeight}px` }}>
              {bannersHeight > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: messageVerticalOffset,
                    left: 0,
                    right: 0,
                    height: `${bannersHeight}px`,
                  }}
                >
                  {renderCommunityBanners()}
                </div>
              )}
              {renderedMessages.map(row => <ConversationMessagePosition key={row.message.localId ?? row.message.id} row={row} shared={props}><ConversationMessageRow row={row} shared={props} /></ConversationMessagePosition>)}
              <div
                ref={messagesEndRef}
                onClick={() => setMessageHelperId(null)}
                className="h-px w-full"
              />
            </div>
          </>
        )}

      </div>
    </div>
  );
});
