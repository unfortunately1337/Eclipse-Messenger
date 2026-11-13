"use client";

import { ChatScene } from "../../components/common/ChatScene";

import { ChevronDown, CloudUpload } from "lucide-react";

import { MessageSearchNavigation } from "../../components/common/MessageSearchBar";

import { PinnedMessageBar } from "../../components/common/PinnedMessageBar";
import { MdDelete } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";

import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";

import { cn } from "@/lib/utils";

import { SecretChatTimer } from "../../components/common/SecretChatTimer";

import { renderEmojiText } from "@/components/EmojiText";

import { ConversationHeader } from "../ConversationHeader";
import { ConversationMessages } from "../ConversationMessages";
import { RecordingPanels } from "../RecordingPanels";
import { MessageContextMenu } from "../MessageContextMenu";
import { MessageComposer } from "../MessageComposer";
import { MessageSelectionToolbar } from "../MessageSelectionToolbar";
import { GroupVideoChatBanner } from "../../components/common/GroupVideoChat";

import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ConversationNavigationModel } from "../controllers/useConversationNavigation";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { MessageEncryptionModel } from "../controllers/useMessageEncryption";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ConversationActionsModel } from "../controllers/useConversationActions";

import { bindConversationHeader, type ConversationHeaderSources } from "../bindings/ConversationHeader";
import { bindConversationMessages, type ConversationMessagesSources } from "../bindings/ConversationMessages";
import { bindRecordingPanels, type RecordingPanelsSources } from "../bindings/RecordingPanels";
import { bindMessageContextMenu, type MessageContextMenuSources } from "../bindings/MessageContextMenu";
import { bindMessageComposer, type MessageComposerSources } from "../bindings/MessageComposer";

export interface ConversationSceneOwnSources {
  readonly active: Pick<ActiveConversationModel, "activeChat" | "expiringChatId" | "handleSecretChatExpired" | "calls">;
  readonly page: Pick<ChatPageStateModel, "t" | "transparentVisual"> & {
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "dragActive">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "selectionMode" | "selectionDeleteDialogOpen" | "setSelectionDeleteDialogOpen" | "selectionDeleting">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "secretChatExpiresAt">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation">;
    account: Pick<ChatPageStateModel["account"], "setActiveUnreadCount" | "activeUnreadCount">;
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "videoRecorderOpen">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "videoFacingMode" | "videoRecordingMs">;

  };
  readonly elements: Pick<ChatElementStateModel, "scrollMessagesToBottom"> & {
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "mobileChatViewportHeight" | "preservingHistoryScrollRef" | "prependScrollSnapshotRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "showScrollToBottomButton" | "setShowScrollToBottomButton">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "footerHeight">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "chatScrollRef" | "chatReadingPositionsRef" | "videoPreviewRef">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "messagesAtBottomRef" | "userScrolledUpRef">;

  };
  readonly navigation: Pick<ConversationNavigationModel, "handleDragEnter" | "handleDragLeave" | "handleDragOver">;
  readonly presentation: Pick<ConversationPresentationModel, "handleDrop" | "isSecretChat">;
  readonly view: Pick<ChatPagePresentationModel, "canDropChatFiles" | "hasChatInputBar">;
  readonly history: Pick<MessageHistoryModel, "messageSearch" | "messagePins" | "pinNavigatingKey">;
  readonly encryption: Pick<MessageEncryptionModel, "pinKey" | "pinnedPreviewText" | "jumpToPinnedMessage">;
  readonly appearance: Pick<ChatAppearanceModel, "chatHeaderThemeStyle" | "composerInputThemeStyle" | "unreadBadgeThemeStyle">;
  readonly messageActions: Pick<ConversationActionsModel, "deleteSelectedMessages">;
}

export type ConversationSceneSources = ConversationSceneOwnSources & ConversationHeaderSources & ConversationMessagesSources & RecordingPanelsSources & MessageContextMenuSources & MessageComposerSources;

export function ConversationScene({ sources }: { sources: ConversationSceneSources }) {
  const { activeChat, expiringChatId, handleSecretChatExpired } = sources.active;
  const { t, transparentVisual } = sources.page;
  const { isDesktop } = sources.page.panels;
  const { dragActive } = sources.page.wallpaperUpload;
  const { selectionMode, selectionDeleteDialogOpen, setSelectionDeleteDialogOpen, selectionDeleting } = sources.page.messageInteraction;
  const { secretChatExpiresAt } = sources.page.secretChatDraft;
  const { activeConversation } = sources.page.conversation;
  const { setActiveUnreadCount, activeUnreadCount } = sources.page.account;
  const { videoRecorderOpen } = sources.page.recorderPresentation;
  const { videoFacingMode, videoRecordingMs } = sources.page.composerInteraction;
  const { scrollMessagesToBottom } = sources.elements;
  const { mobileChatViewportHeight, preservingHistoryScrollRef, prependScrollSnapshotRef } = sources.elements.conversationRequest;
  const { showScrollToBottomButton, setShowScrollToBottomButton } = sources.elements.storyAndViewport;
  const { footerHeight } = sources.elements.messageDelivery;
  const { chatScrollRef, chatReadingPositionsRef, videoPreviewRef } = sources.elements.conversationElement;
  const { messagesAtBottomRef, userScrolledUpRef } = sources.elements.conversationScroll;
  const { handleDragEnter, handleDragLeave, handleDragOver } = sources.navigation;
  const { handleDrop, isSecretChat } = sources.presentation;
  const { canDropChatFiles, hasChatInputBar } = sources.view;
  const { messageSearch, messagePins, pinNavigatingKey } = sources.history;
  const { pinKey, pinnedPreviewText, jumpToPinnedMessage } = sources.encryption;
  const { chatHeaderThemeStyle, composerInputThemeStyle, unreadBadgeThemeStyle } = sources.appearance;
  const { deleteSelectedMessages } = sources.messageActions;
  const secretKeys = isSecretChat && activeChat?.link === `secret-${activeConversation?.conversationId?.replace(/^secret:/, "")}` && activeConversation?.secretCrypto?.version === 2
    ? { ownKey: activeConversation.secretCrypto.ownPublicKey ?? undefined, peerKey: activeConversation.peer?.publicKey ?? undefined }
    : null;
  return (
    <ChatScene
      open={Boolean(activeChat)}
      desktop={isDesktop}
      sceneKey={activeChat ? `${activeChat.chatType}:${activeChat.peerId || activeChat.link}` : null}
      expiring={Boolean(expiringChatId && activeChat && (activeChat.conversationId === `secret:${expiringChatId}` || activeChat.link === `secret-${expiringChatId}`))}
      style={
        !isDesktop && mobileChatViewportHeight
          ? {
            height: `${mobileChatViewportHeight}px`,
            maxHeight: `${mobileChatViewportHeight}px`,
          }
          : undefined
      }
      onDragEnter={handleDragEnter}
      data-chat-file-zone="true"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {dragActive && canDropChatFiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            data-chat-file-drop="true"
            className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/30 pointer-events-none"
          >
            <div className="mx-5 flex w-[300px] max-w-full flex-col items-center gap-3 rounded-[24px] border border-dashed border-white/25 bg-[#202024] px-6 py-7 text-center shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
              <CloudUpload size={36} strokeWidth={1.6} className="text-zinc-200" />
              <div className="space-y-1.5">
                <p className="text-[16px] font-semibold text-zinc-100">{t("Отпустите файлы здесь")}</p>
                <p className="text-[13px] leading-5 text-zinc-400">{t("До 6 фото или видео, либо один файл")}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!activeChat ? (
        <div className="grid h-full place-items-center">
          <div
            className="rounded-full border border-white/[0.03] bg-zinc-900/28 px-4 py-1.5 text-[15px] font-semibold leading-none text-white/88 shadow-none backdrop-blur-[6px]"
          >
            {t("Здесь появятся ваши диалоги")}</div>
        </div>
      ) : (
        <>
          <ConversationHeader {...bindConversationHeader(sources, activeChat)} />
          <div
            inert={messageSearch.open}
            aria-hidden={messageSearch.open}
            className={cn("pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-[920px] px-2.5 pb-1 md:px-5", messageSearch.open && "invisible")}
            style={{
              paddingTop: isDesktop
                ? "calc(2.5rem + 14px)"
                : "calc(max(env(safe-area-inset-top), 8px) + 48px + 6px)",
            }}
          >
            <AnimatePresence initial={false}>
              {messagePins.active && !selectionMode && <PinnedMessageBar key={pinKey} messageId={messagePins.active.id}
                count={messagePins.pins.length} index={messagePins.index} busy={pinNavigatingKey === pinKey}
                preview={renderEmojiText(pinnedPreviewText, { size: 14 })} style={chatHeaderThemeStyle}
                onClick={() => void jumpToPinnedMessage()} />}
            </AnimatePresence>
            <div id="global-voice-chat-slot" className={cn("pointer-events-auto empty:hidden pb-1", messagePins.active && !selectionMode && "mt-2")}>
              {activeConversation?.chatType === "group" && activeChat && !selectionMode && <GroupVideoChatBanner key={activeChat.link}
                link={activeChat.link} title={activeChat.displayName} avatarUrl={activeChat.avatarUrl}
                style={chatHeaderThemeStyle} />}
            </div>
            <div id="global-music-chat-slot" className={cn("pointer-events-auto empty:hidden pb-1", messagePins.active && !selectionMode && "mt-2")} />
            {isSecretChat && activeChat && (
              <div className="pointer-events-auto mx-auto mt-1 flex flex-col items-center gap-1">
                <SecretChatTimer
                  key={activeChat.link}
                  chatId={activeChat.link.replace(/^secret-/, "")}
                  ownKey={secretKeys?.ownKey}
                  peerKey={secretKeys?.peerKey}
                  transparentVisual={transparentVisual}
                  initialExpiresAt={secretChatExpiresAt ?? undefined}
                  onExpired={handleSecretChatExpired}
                  style={chatHeaderThemeStyle}
                />
              </div>
            )}
          </div>
          <ConversationMessages {...bindConversationMessages(sources)} />

          <RecordingPanels {...bindRecordingPanels(sources)} />

          <ConfirmationSheet
            open={selectionDeleteDialogOpen && selectionMode}
            onOpenChange={setSelectionDeleteDialogOpen}
            title={t("Удалить сообщения?")}
            description={t("Выбранные сообщения будут удалены у всех участников чата.")}
            actionLabel={selectionDeleting ? t("Удаление...") : t("Удалить")}
            actionIcon={MdDelete}
            actionDisabled={selectionDeleting}
            onAction={() => void deleteSelectedMessages()}
            zIndex={150}
          />

          <MessageContextMenu {...bindMessageContextMenu(sources)} />

          <AnimatePresence>
            {showScrollToBottomButton && !messageSearch.open ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-2.5 md:px-6 lg:px-7">
                <div className="relative mx-auto w-full max-w-[700px]">
                  <motion.div
                    key="scroll-to-bottom"
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.9 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      bottom: hasChatInputBar
                        ? `calc(${footerHeight}px + ${isDesktop ? "6px" : "5px"})`
                        : undefined,
                    }}
                    className={cn(
                      "pointer-events-none absolute right-0 z-30 transition-[bottom] duration-200",
                      hasChatInputBar
                        ? "bottom-[calc(env(safe-area-inset-bottom)+48px)] md:bottom-[54px]"
                        : "bottom-[calc(env(safe-area-inset-bottom)+8px)] md:bottom-2.5"
                    )}
                  >
                    <button
                      type="button"
                      aria-label={t("Прокрутить в самый низ")}
                      title={t("В самый низ")}
                      onClick={() => {
                        preservingHistoryScrollRef.current = false;
                        prependScrollSnapshotRef.current = null;
                        const chat = chatScrollRef.current;
                        if (chat) {
                          chat.initial = false;
                          chatReadingPositionsRef.current.delete(chat.key);
                        }
                        messagesAtBottomRef.current = true;
                        setShowScrollToBottomButton(false);
                        userScrolledUpRef.current = false;
                        scrollMessagesToBottom("smooth");
                        setActiveUnreadCount(0);
                      }}
                      style={composerInputThemeStyle}
                      className="group relative pointer-events-auto inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full border border-white/10 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[16px] transition-all duration-200 hover:text-white hover:border-white/15 hover:shadow-[0_12px_28px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.14)] active:scale-92 cursor-pointer"
                    >
                      <ChevronDown size={19} strokeWidth={2.3} className="transition-transform duration-150 group-hover:translate-y-[1px]" />
                      {activeUnreadCount > 0 ? (
                        <span
                          className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${unreadBadgeThemeStyle
                            ? "shadow-[0_4px_10px_-4px_rgba(0,0,0,0.65)]"
                            : "bg-zinc-300 text-zinc-950 dark:bg-zinc-400 dark:text-zinc-950"
                            }`}
                          style={unreadBadgeThemeStyle}
                        >
                          {activeUnreadCount > 99 ? "99+" : activeUnreadCount}
                        </span>
                      ) : null}
                    </button>
                  </motion.div>
                </div>
              </div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {videoRecorderOpen ? (
              <motion.div
                data-video-recorder-overlay
                className={cn(
                  "absolute inset-x-0 top-0 z-[70] p-4 pointer-events-none backdrop-blur-[3.5px] bg-black/20 flex items-center justify-center",
                  "bottom-[calc(env(safe-area-inset-bottom)+70px)] md:bottom-[72px]",
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <motion.div
                  className="relative w-full max-w-sm bg-transparent p-0 border-0 shadow-none pointer-events-auto"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div className="relative mx-auto flex items-center justify-center">
                    <div className="relative aspect-square w-[min(78vw,300px,calc(100dvh-180px))] max-w-full shrink-0 md:w-[min(280px,calc(100dvh-180px))] overflow-hidden rounded-full bg-black shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
                      <video
                        ref={videoPreviewRef}
                        data-video-recorder-preview
                        controls={false}
                        controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
                        disablePictureInPicture
                        disableRemotePlayback
                        tabIndex={-1}
                        onContextMenu={event => event.preventDefault()}
                        muted
                        playsInline
                        autoPlay
                        className={cn("pointer-events-none h-full w-full object-cover rounded-full", videoFacingMode === "user" ? "-scale-x-100" : "")}
                      />
                      {/* Telegram-style circular progress indicator running along the outer rim */}
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                        viewBox="0 0 100 100"
                      >
                        {/* Background track ring */}
                        <circle
                          cx="50"
                          cy="50"
                          r={48}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.2)"
                          strokeWidth="1.6"
                        />
                        {/* Active progress ring */}
                        <circle
                          cx="50"
                          cy="50"
                          r={48}
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.95)"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 48}
                          strokeDashoffset={(2 * Math.PI * 48) * (1 - Math.min(1, videoRecordingMs / 60000))}
                          className="transition-[stroke-dashoffset] duration-100 ease-linear"
                        />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {messageSearch.open && <div data-message-search-navigation style={{ zIndex: 90, isolation: "isolate" }} className="pointer-events-none absolute inset-x-0 bottom-0 px-2.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1 md:px-6 md:py-2.5 lg:px-7">
            <MessageSearchNavigation desktop={isDesktop} query={messageSearch.query} count={messageSearch.matches.length} index={messageSearch.index} busy={messageSearch.busy} hasMore={messageSearch.hasMore} failed={messageSearch.failed} style={composerInputThemeStyle} onMove={messageSearch.move} />
          </div>}

          <MessageComposer {...bindMessageComposer(sources)} selectionMode={selectionMode}
            selectionToolbar={selectionMode ? <MessageSelectionToolbar {...bindConversationHeader(sources, activeChat)} /> : null} />
        </>
      )}
    </ChatScene>
  );
}
