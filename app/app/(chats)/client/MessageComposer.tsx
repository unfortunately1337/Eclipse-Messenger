"use client";

import { type DecryptedMessage, type ConversationResponse, type ChatSummary, type ChatActionPanelState, type EditTarget, type StoryReplyTarget, type PendingAlbumItem, type PendingImagePayload, type PendingVideoPayload, type PendingAudioPayload, type PendingFilePayload, type ChatUiSettings } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type CustomChatTheme } from "@/lib/client/custom-chat-theme";
import { type BotManagementState, type BotManagementAction } from "@/lib/bot-management";
import { type BotChatSettings } from "@/lib/bot-chat-settings";
import AccountPackPicker from "@/components/AccountPackPicker";
import { PANEL_TRANSITION } from "@/lib/client/panel-motion";
import { BotMenuToggle, BotReplyMenu } from "../components/common/BotChatControls";
import { CSSProperties, ChangeEvent, memo } from "react";
import { Check, CircleAlert, Copy, Image as ImageIcon, KeySquare, BarChart3, Music, Paperclip, Smile, SquarePlay, X } from "lucide-react";
import { useMessageSearch } from "../hooks/useMessageSearch";
import { RiMicFill, RiReplyFill } from "react-icons/ri";
import { IoSend, IoArrowRedo } from "react-icons/io5";
import { AiFillCamera } from "react-icons/ai";
import { PiStickerBold } from "react-icons/pi";
import { FaArrowsRotate } from "react-icons/fa6";
import { MdDelete, MdEdit } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EclipseBotMenu } from "../components/common/EclipseBotMenu";
import { CgMenuRound } from "react-icons/cg";
import { cn } from "@/lib/utils";
import { type ForwardedContent } from "@/lib/client/message-forwarding";
import { EmojiComposer, type EmojiComposerHandle } from "@/components/EmojiComposer";
import TextEmojiPicker from "@/components/TextEmojiPicker";
import { MediaRecordingBar, RecordingCancelButton } from "../MediaRecordingBar";
import { RecordingModeHint } from "../components/common/RecordingModeHint";
import { formatForwardMessageCount, getReplyPreviewText } from "./message-presentation";
import { formatDurationFromSeconds } from "./media-recording";
import { formatFileSize } from "./media-files";

/* eslint-disable @next/next/no-img-element */

export interface MessageComposerProps {
  footerRef: React.RefObject<HTMLDivElement | null>;
  messageSearch: ReturnType<typeof useMessageSearch>;
  videoRecording: boolean;
  videoRecorderOpen: boolean;
  stickerPickerOpen: boolean;
  isEclipseConversation: boolean;
  isManagedBotConversation: boolean;
  messages: DecryptedMessage[];
  startActiveBot: () => Promise<boolean>;
  startingBot: boolean;
  loadingConversation: boolean;
  t: (source: string, values?: TranslationValues | undefined) => string;
  activeConversation: ConversationResponse | null;
  canPostToChannel: boolean;
  canSubscribeToChannel: boolean;
  subscribeToActiveChannel: () => Promise<void>;
  activeChat: ChatSummary | null;
  toggleChatMutedState: (link: string) => void;
  composerInputThemeStyle: React.CSSProperties;
  mutedChatLinkSet: Set<string>;
  canJoinGroup: boolean;
  joinActiveGroup: () => Promise<void>;
  joiningGroup: boolean;
  chatActionPanel: ChatActionPanelState | null;
  chatActionPanelThemeStyle: React.CSSProperties | undefined;
  hasRenderedPicker: boolean;
  isDesktop: boolean;
  mobileEmojiPickerHeight: number;
  composerPickerTab: "emoji" | "stickers" | "gif";
  preventPickerCloseOnFocusRef: React.RefObject<boolean>;
  messageInputRef: React.RefObject<EmojiComposerHandle | null>;
  sendStickerFromPicker: (src: string, emoji?: string | undefined) => Promise<void>;
  setComposerPickerTab: React.Dispatch<React.SetStateAction<"emoji" | "stickers" | "gif">>;
  attachmentMenuOpen: boolean;
  setAttachmentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  setPollQuestion: React.Dispatch<React.SetStateAction<string>>;
  setPollOptions: React.Dispatch<React.SetStateAction<string[]>>;
  setPollQuizMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPollCorrectOptionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPollExpiresInHours: React.Dispatch<React.SetStateAction<number | null>>;
  setPollDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  syncing: boolean;
  editTarget: EditTarget | null;
  onPickMedia: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  voiceRecording: boolean;
  cancelVoiceRecording: () => void;
  cancelVideoRecording: () => void;
  isSecretChatComposerBlocked: boolean;
  activeTitle: string;
  isSecretChatAcceptRequired: boolean;
  acceptSecretChat: () => Promise<void>;
  acceptingSecretChat: boolean;
  declineSecretChat: () => Promise<void>;
  setStickerPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  forwardDraft: { link: string; chatType: "direct" | "group" | "channel" | "saved"; share?: boolean | undefined; messages: (ForwardedContent & { requestId: string; preparedContent?: string | undefined; })[]; } | null;
  replyTargetMessage: DecryptedMessage | null;
  storyReplyTarget: StoryReplyTarget | null;
  pendingMediaBatch: PendingAlbumItem[] | null;
  pendingImage: PendingImagePayload | null;
  pendingVideo: PendingVideoPayload | null;
  pendingAudio: PendingAudioPayload | null;
  pendingFile: PendingFilePayload | null;
  selfId: string | null;
  forwardSending: boolean;
  setForwardDraft: React.Dispatch<React.SetStateAction<{ link: string; chatType: "direct" | "group" | "channel" | "saved"; share?: boolean | undefined; messages: (ForwardedContent & { requestId: string; preparedContent?: string | undefined; })[]; } | null>>;
  activeCustomTheme: CustomChatTheme | null | undefined;
  replyComposerAuthor: string;
  cancelEditMode: () => void;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  setPendingMediaBatch: React.Dispatch<React.SetStateAction<PendingAlbumItem[] | null>>;
  sendingMedia: boolean;
  setPendingImage: React.Dispatch<React.SetStateAction<PendingImagePayload | null>>;
  setPendingVideo: React.Dispatch<React.SetStateAction<PendingVideoPayload | null>>;
  setPendingAudio: React.Dispatch<React.SetStateAction<PendingAudioPayload | null>>;
  setPendingFile: React.Dispatch<React.SetStateAction<PendingFilePayload | null>>;
  voiceRecordingStream: MediaStream | null;
  videoRecordingStream: MediaStream | null;
  voiceRecordingMs: number;
  videoRecordingMs: number;
  voiceWaveformSamplesRef: React.RefObject<number[]>;
  eclipseBots: { state: BotManagementState | null; menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; busy: boolean; error: string | null; act: (action: BotManagementAction, options?: { text?: string | undefined; botId?: string | undefined; file?: File | undefined; }) => Promise<boolean>; refresh: () => Promise<BotManagementState>; };
  messageText: string;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  messagesAtBottomRef: React.RefObject<boolean>;
  scrollMessagesToBottom: (behavior?: ScrollBehavior) => void;
  chatUiSettings: ChatUiSettings;
  sending: boolean;
  sendingMessageInFlightRef: React.RefObject<boolean>;
  sendMessage: () => Promise<void>;
  botChatUi: { settings: BotChatSettings; commands: { command: string; description: string; }[]; menuOpen: boolean; setMenuOpen: (open: boolean) => void; busy: boolean; callback: (row: number, column: number) => Promise<void>; };
  isSecretChat: boolean;
  sendPreparedMessage: (payloadText: string, options?: { resetComposer?: boolean | undefined; replyToMessageId?: string | null | undefined; optimisticMessageId?: string | null | undefined; throwOnError?: boolean | undefined; } | undefined) => Promise<void>;
  editSaving: boolean;
  flipVideoCamera: () => Promise<void>;
  videoCameraSwitching: boolean;
  finishVoiceRecording: (send: boolean) => Promise<void>;
  finishVideoRecording: (send: boolean) => Promise<void>;
  composerSendButtonToneClassName: "bg-white text-zinc-950 hover:!bg-[#e4e4e7] active:!bg-[#d4d4d8] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-colors duration-150" | "text-white hover:brightness-90 hover:saturate-110 active:brightness-75 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-[filter,transform] duration-150";
  composerSendButtonStyle: React.CSSProperties;
  canSubmitMessage: boolean;
  privateKey: CryptoKey | null;
  selfPublicKey: string | null;
  composerRecordMode: "video" | "voice";
  recordModeHintUntil: number;
  transparentVisual: boolean;
  micRecordButtonRef: React.RefObject<HTMLButtonElement | null>;
  handleMicPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicClick: () => void;
  reducedPanelMotion: boolean | null;
  openExternalLinkPrompt: (url: string) => void;
}

export const MessageComposer = memo(function MessageComposer({ footerRef, messageSearch, videoRecording, videoRecorderOpen, stickerPickerOpen, isEclipseConversation, isManagedBotConversation, messages, startActiveBot, startingBot, loadingConversation, t, activeConversation, canPostToChannel, canSubscribeToChannel, subscribeToActiveChannel, activeChat, toggleChatMutedState, composerInputThemeStyle, mutedChatLinkSet, canJoinGroup, joinActiveGroup, joiningGroup, chatActionPanel, chatActionPanelThemeStyle, hasRenderedPicker, isDesktop, mobileEmojiPickerHeight, composerPickerTab, preventPickerCloseOnFocusRef, messageInputRef, sendStickerFromPicker, setComposerPickerTab, attachmentMenuOpen, setAttachmentMenuOpen, imageInputRef, setPollQuestion, setPollOptions, setPollQuizMode, setPollCorrectOptionIndex, setPollExpiresInHours, setPollDialogOpen, syncing, editTarget, onPickMedia, voiceRecording, cancelVoiceRecording, cancelVideoRecording, isSecretChatComposerBlocked, activeTitle, isSecretChatAcceptRequired, acceptSecretChat, acceptingSecretChat, declineSecretChat, setStickerPickerOpen, forwardDraft, replyTargetMessage, storyReplyTarget, pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile, selfId, forwardSending, setForwardDraft, activeCustomTheme, replyComposerAuthor, cancelEditMode, setReplyToMessageId, setStoryReplyTarget, setPendingMediaBatch, sendingMedia, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile, voiceRecordingStream, videoRecordingStream, voiceRecordingMs, videoRecordingMs, voiceWaveformSamplesRef, eclipseBots, messageText, setMessageText, messagesAtBottomRef, scrollMessagesToBottom, chatUiSettings, sending, sendingMessageInFlightRef, sendMessage, botChatUi, isSecretChat, sendPreparedMessage, editSaving, flipVideoCamera, videoCameraSwitching, finishVoiceRecording, finishVideoRecording, composerSendButtonToneClassName, composerSendButtonStyle, canSubmitMessage, privateKey, selfPublicKey, composerRecordMode, recordModeHintUntil, transparentVisual, micRecordButtonRef, handleMicPointerDown, handleMicPointerMove, handleMicPointerUp, handleMicPointerCancel, handleMicClick, reducedPanelMotion, openExternalLinkPrompt }: MessageComposerProps) {
  return (
    <footer
      ref={footerRef}
      inert={messageSearch.open}
      aria-hidden={messageSearch.open}
      className={cn(
        messageSearch.open && "invisible",
        "pointer-events-none absolute inset-x-0 bottom-0 px-2.5 pt-1 md:px-6 md:py-2.5 lg:px-7",
        (videoRecording || videoRecorderOpen) ? "z-[95]" : "z-[85]",
        stickerPickerOpen ? "pb-0 md:pb-2.5" : "pb-[calc(env(safe-area-inset-bottom)+6px)]"
      )}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-[700px]" data-eclipse-bot-composer={isEclipseConversation ? "" : undefined}>
        {isManagedBotConversation && messages.length === 0 ? (
          <div className="flex items-center justify-center">
            <Button type="button" onClick={() => void startActiveBot()} disabled={startingBot || loadingConversation}
              className="h-8 min-w-[80px] rounded-full px-4">
              {startingBot ? <Spinner className="h-4 w-4 animate-spin" /> : t("Старт")}
            </Button>
          </div>
        ) : activeConversation?.chatType === "channel" && !canPostToChannel ? (
          canSubscribeToChannel ? (
            <div className="flex items-center justify-center">
              <Button
                type="button"
                onClick={() => void subscribeToActiveChannel()}
                className="h-8 rounded-full px-4"
              >
                {t("Подписаться")}</Button>
            </div>
          ) : (
            <div className="flex justify-center w-full my-1">
              <button
                type="button"
                onClick={() => {
                  const targetLink = activeChat?.link || activeConversation?.peer?.link;
                  if (targetLink) {
                    toggleChatMutedState(targetLink);
                  }
                }}
                className="flex items-center justify-center gap-2 h-9 rounded-full border border-white/10 px-5 text-[13.5px] font-semibold text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-[16px] hover:bg-white/5 active:scale-98 transition-all pointer-events-auto"
                style={composerInputThemeStyle}
              >
                {(() => {
                  const targetLink = activeChat?.link || activeConversation?.peer?.link;
                  const isMuted = targetLink ? mutedChatLinkSet.has(targetLink) : false;
                  return isMuted ? (
                    <span>{t("Включить звук")}</span>
                  ) : (
                    <span>{t("Выключить звук")}</span>
                  );
                })()}
              </button>
            </div>
          )
        ) : activeConversation?.chatType === "group" && canJoinGroup ? (
          <div className="flex items-center justify-center">
            <Button
              type="button"
              onClick={() => void joinActiveGroup()}
              disabled={joiningGroup}
              className="h-8 rounded-lg px-5 bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast)] hover:opacity-90 font-medium cursor-pointer"
            >
              {joiningGroup ? <Spinner className="h-4 w-4 animate-spin text-[color:var(--ui-accent-contrast)]" /> : t("Вступить")}
            </Button>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {chatActionPanel ? (
                <motion.div
                  key={chatActionPanel.id}
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.98 }}
                  transition={PANEL_TRANSITION}
                  className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 px-3"
                >
                  <div
                    className={`pointer-events-auto mx-auto flex w-full items-center gap-2.5 rounded-[24px] border px-4 py-2 text-white shadow-[0_22px_52px_rgba(0,0,0,0.5)] backdrop-blur-md ${chatActionPanelThemeStyle ? "" : "border-white/4 bg-zinc-950/96"
                      }`}
                    style={chatActionPanelThemeStyle}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center text-white/92">
                      {chatActionPanel.icon === "copy" ? (
                        <Copy size={15} />
                      ) : chatActionPanel.icon === "trash" ? (
                        <MdDelete size={17} />
                      ) : chatActionPanel.icon === "error" ? (
                        <CircleAlert size={15} />
                      ) : chatActionPanel.icon === "success" ? (
                        <Check size={15} className="text-emerald-400" />
                      ) : (
                        <KeySquare size={15} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-[13px] font-medium leading-4 text-white/94">
                      {t(chatActionPanel.message)}
                    </div>
                    {chatActionPanel.actionLabel && chatActionPanel.onAction ? (
                      <button
                        type="button"
                        onClick={chatActionPanel.onAction}
                        className="shrink-0 text-[12px] font-semibold text-white/92 transition-colors hover:text-white"
                      >
                        {chatActionPanel.actionLabel}
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Pending media previews moved to input bubble container */}
            <div className="relative flex flex-col">
              {hasRenderedPicker && (
                <motion.div
                  initial={false}
                  animate={stickerPickerOpen ? "open" : "closed"}
                  data-sticker-picker="true"
                  variants={{
                    open: {
                      height: isDesktop ? 292 : mobileEmojiPickerHeight,
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                      pointerEvents: "auto",
                      display: "block"
                    },
                    closed: {
                      height: 0,
                      opacity: 0,
                      y: 14,
                      scale: 0.96,
                      filter: "blur(6px)",
                      pointerEvents: "none",
                      transitionEnd: { display: "none" }
                    }
                  }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="order-2 mx-0 mt-2 mb-2 overflow-hidden rounded-[24px] text-zinc-100 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-[16px] md:absolute md:bottom-[calc(100%+12px)] md:left-0 md:z-50 md:mb-0 md:mt-0 md:w-[360px] md:shadow-[0_16px_40px_rgba(0,0,0,0.32)]"
                  style={{ ...composerInputThemeStyle, border: 0 }}
                >
                  <div className="relative flex h-full flex-col">
                    <div className="min-h-0 flex-1 overflow-hidden px-3 pt-1.5 no-scrollbar md:px-4">
                      {composerPickerTab === "emoji" ? (
                        <TextEmojiPicker mobile={!isDesktop} onSelect={value => {
                          preventPickerCloseOnFocusRef.current = true;
                          messageInputRef.current?.insertText(value, isDesktop);
                        }} />
                      ) : composerPickerTab === "stickers" ? (
                        <AccountPackPicker kind="sticker" showRecent mobile={!isDesktop} onSticker={item => void sendStickerFromPicker(item.src, item.emoji)} />
                      ) : (
                        <div className="flex h-full min-h-[150px] items-center justify-center text-[14px] font-medium text-zinc-500">
                          {t("GIF появятся позже")}</div>
                      )}
                    </div>
                    <div className="pointer-events-none z-10 flex shrink-0 items-center justify-center pt-1 pb-[max(10px,env(safe-area-inset-bottom))]">
                      <div
                        data-media-picker-tabs
                        className="pointer-events-auto inline-flex h-10 md:h-9 shrink-0 items-center justify-center gap-1 rounded-full bg-transparent p-1 text-white shadow-none"
                        style={{ border: 0 }}
                      >
                        <button
                          type="button"
                          onClick={() => setComposerPickerTab("emoji")}
                          className={cn(
                            "flex h-8 min-w-[40px] md:h-7 items-center justify-center rounded-full px-2.5 transition-all duration-200 active:scale-95 cursor-pointer",
                            composerPickerTab === "emoji"
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                          )}
                          aria-label={t("Эмодзи")}
                        >
                          <Smile size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerPickerTab("stickers")}
                          className={cn(
                            "flex h-8 min-w-[40px] md:h-7 items-center justify-center rounded-full px-2.5 transition-all duration-200 active:scale-95 cursor-pointer",
                            composerPickerTab === "stickers"
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                          )}
                          aria-label={t("Стикеры")}
                        >
                          <PiStickerBold size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerPickerTab("gif")}
                          className={cn(
                            "flex h-8 min-w-[40px] md:h-7 items-center justify-center rounded-full px-2.5 transition-all duration-200 active:scale-95 cursor-pointer",
                            composerPickerTab === "gif"
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                          )}
                          aria-label="GIF"
                        >
                          <span className="text-[11px] font-bold tracking-wider">GIF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <AnimatePresence>
                {attachmentMenuOpen ? (
                  <>
                    <motion.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                      onClick={() => setAttachmentMenuOpen(false)}
                      className="fixed inset-0 z-[130] bg-black/10"
                      aria-label={t("Закрыть меню вложений")}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 4 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                      className="absolute bottom-[calc(100%+10px)] left-0 z-[140] origin-bottom-left"
                    >
                      <div
                        className="pointer-events-auto flex min-w-[200px] flex-col items-stretch gap-0.5 rounded-[22px] border border-white/8 p-1.5 text-zinc-100 shadow-[0_18px_42px_rgba(0,0,0,0.35)] backdrop-blur-[16px]"
                        style={composerInputThemeStyle}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentMenuOpen(false);
                            if (imageInputRef.current) {
                              imageInputRef.current.accept = "image/*,video/*";
                              imageInputRef.current.click();
                            }
                          }}
                          className="flex h-9 w-full items-center gap-3 rounded-[12px] px-2.5 text-left text-[13.5px] font-medium text-white/95 transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.98]"
                        >
                          <ImageIcon size={18} className="shrink-0 text-white/80" />
                          <span>{t("Фото или видео")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentMenuOpen(false);
                            if (imageInputRef.current) {
                              imageInputRef.current.accept = "*/*";
                              imageInputRef.current.click();
                            }
                          }}
                          className="flex h-9 w-full items-center gap-3 rounded-[12px] px-2.5 text-left text-[13.5px] font-medium text-white/95 transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.98]"
                        >
                          <Paperclip size={18} className="shrink-0 text-white/80" />
                          <span>{t("Файл")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentMenuOpen(false);
                            setPollQuestion("");
                            setPollOptions(["", ""]);
                            setPollQuizMode(false);
                            setPollCorrectOptionIndex(null);
                            setPollExpiresInHours(24);
                            setPollDialogOpen(true);
                          }}
                          disabled={syncing || Boolean(editTarget)}
                          className="flex h-9 w-full items-center gap-3 rounded-[12px] px-2.5 text-left text-[13.5px] font-medium text-white/95 transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-40"
                        >
                          <BarChart3 size={18} className="shrink-0 text-white/80" />
                          <span>{t("Опрос")}</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>

              <input
                ref={imageInputRef}
                type="file"
                accept="*/*"
                multiple
                className="hidden"
                onChange={(event) => void onPickMedia(event)}
              />
              <div data-recording-composer-row className="relative order-1 mt-0.5 flex w-full gap-2 items-end justify-center text-white select-none">
                {(voiceRecording || videoRecording) && (
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 flex -translate-x-1/2 items-center md:hidden">
                    <RecordingCancelButton onCancel={voiceRecording ? cancelVoiceRecording : cancelVideoRecording} />
                  </div>
                )}
                {isSecretChatComposerBlocked ? (
                  <div role="status" style={composerInputThemeStyle} className="flex h-9 max-w-[min(100%,300px)] items-center justify-center rounded-full border border-white/8 px-4 text-[13px] font-medium text-zinc-400">
                    <span className="truncate">{t("Ожидаем ответа от ")}{activeTitle}</span>
                  </div>
                ) : isSecretChatAcceptRequired ? (
                  <div className="flex max-w-full items-center justify-center gap-2 py-1">
                    <button
                      type="button"
                      onClick={() => void acceptSecretChat()}
                      disabled={acceptingSecretChat}
                      className="inline-flex h-9 min-w-[104px] items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold text-zinc-950 transition-[background-color,transform] duration-150 hover:bg-zinc-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-default cursor-pointer"
                    >
                      {acceptingSecretChat ? (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
                      ) : (
                        t("Принять")
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void declineSecretChat()}
                      disabled={acceptingSecretChat}
                      style={composerInputThemeStyle}
                      className="inline-flex h-9 min-w-[104px] items-center justify-center rounded-full border border-white/8 px-4 text-[13px] font-medium text-zinc-300 transition-[filter,transform,color] duration-150 hover:brightness-110 hover:text-white active:scale-[0.97] disabled:opacity-50 disabled:cursor-default cursor-pointer"
                    >
                      {t("Отклонить")}</button>
                  </div>
                ) : (
                  <>
                    {!voiceRecording && !videoRecording && !isSecretChatComposerBlocked ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setStickerPickerOpen(false);
                          setAttachmentMenuOpen((prev) => !prev);
                        }}
                        disabled={syncing || Boolean(editTarget)}
                        className={cn(
                          "composer-round-action h-[38px] w-[38px] shrink-0 rounded-full border p-0 shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:!bg-white/5 transition-all duration-200 active:scale-95 flex items-center justify-center border-white/8 md:h-[42px] md:w-[42px]",
                          attachmentMenuOpen ? "text-zinc-100" : "text-zinc-300 hover:text-white"
                        )}
                        style={composerInputThemeStyle}
                        aria-label={t("Открыть меню вложений")}
                      >
                        <Paperclip size={17} />
                      </Button>
                    ) : null}

                    <div
                      data-message-composer-surface
                      className={cn(
                        "flex flex-col flex-1 min-w-0 text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-[16px] border border-white/8",
                        (forwardDraft || editTarget || replyTargetMessage || storyReplyTarget || pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile)
                          ? "rounded-[20px] md:rounded-[22px] overflow-hidden"
                          : (voiceRecording || videoRecording)
                            ? "rounded-full"
                            : "rounded-[24px] md:rounded-[28px]"
                      )}
                      style={composerInputThemeStyle}
                    >
                      {forwardDraft && <div data-forward-draft className="flex items-center gap-2 px-3.5 pt-2 pb-1"><IoArrowRedo size={18} className="shrink-0 text-zinc-300" /><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold">{forwardDraft.share ? t("Отправить аудиофайл") : forwardDraft.messages.length === 1 ? t("Переслать сообщение") : t("Переслать сообщения")}</div><div className="truncate text-xs text-zinc-400">{forwardDraft.messages.length > 1 ? formatForwardMessageCount(forwardDraft.messages.length) : `${!forwardDraft.share ? `${forwardDraft.messages[0].author.id === selfId ? t("Вы") : forwardDraft.messages[0].author.name}: ` : ""}${getReplyPreviewText(forwardDraft.messages[0].content)}`}</div></div><button aria-label={t("Отменить пересылку")} disabled={forwardSending} onClick={() => setForwardDraft(null)} className="grid h-8 w-8 shrink-0 place-items-center text-zinc-400"><X size={16} /></button></div>}
                      {(editTarget || replyTargetMessage || storyReplyTarget) && (
                        <motion.div
                          key={editTarget ? `edit:${editTarget.id}` : replyTargetMessage ? `reply:${replyTargetMessage.id}` : `story:${storyReplyTarget?.storyId}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="overflow-hidden"
                        >
                          <div className={cn("flex items-center justify-between gap-3 px-3.5 pt-1.5 pb-0.5 bg-transparent", !editTarget && activeCustomTheme?.replyBackground && "[&_span]:text-inherit [&_svg]:text-inherit")}
                            style={!editTarget ? { backgroundColor: "var(--reply-preview-background)", color: "var(--reply-preview-text)" } : undefined}>
                            <div className="flex items-center gap-2 min-w-0">
                              {editTarget ? (
                                <>
                                  <MdEdit size={15} className="text-zinc-300 shrink-0" />
                                  <span className="text-[12.5px] font-semibold text-zinc-100 truncate select-none">
                                    {t("Редактирование")}</span>
                                </>
                              ) : (
                                <>
                                  <RiReplyFill size={15} className="text-zinc-300 shrink-0" />
                                  <span className="text-[12.5px] text-zinc-200/90 truncate select-none">
                                    {activeConversation?.chatType === "channel" ? (
                                      <span className="font-semibold text-zinc-100">{t("Ответ на публикацию")}</span>
                                    ) : (
                                      <>{t("В ответ ")}<span className="font-semibold text-zinc-100">{replyTargetMessage ? replyComposerAuthor : storyReplyTarget?.authorName}</span></>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (editTarget) {
                                  cancelEditMode();
                                } else {
                                  setReplyToMessageId(null);
                                  setStoryReplyTarget(null);
                                }
                              }}
                              className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                              aria-label={t("Закрыть")}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      <AnimatePresence initial={false}>
                        {Boolean(pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3.5 pb-1 pt-2.5 bg-transparent">
                              {/* Render pendingMediaBatch */}
                              {pendingMediaBatch?.map((item, index) => (
                                <div key={`batch-${item.previewUrl}-${index}`} className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-950 shadow-sm">
                                  {item.kind === "video" ? (
                                    <video src={item.previewUrl} muted playsInline className="h-full w-full object-cover" />
                                  ) : (
                                    <img src={item.previewUrl} alt="preview" className="h-full w-full object-cover" />
                                  )}
                                  {item.kind === "video" && (
                                    <div className="absolute left-1 bottom-1 rounded-md bg-black/60 p-0.5 text-white">
                                      <SquarePlay size={10} />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                                      setPendingMediaBatch((prev) => {
                                        if (!prev || prev.length === 0) return null;
                                        const next = prev.filter((_, idx) => idx !== index);
                                        return next.length > 0 ? next : null;
                                      });
                                    }}
                                    className="absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                                    aria-label={t("Убрать элемент")}
                                  >
                                    <X size={10} />
                                  </button>
                                  {sendingMedia && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                      <Spinner className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Render pendingImage */}
                              {pendingImage && (
                                <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-955 shadow-sm">
                                  <img src={pendingImage.previewUrl} alt="preview" className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (pendingImage.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
                                      setPendingImage(null);
                                    }}
                                    className="absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                                    aria-label={t("Убрать фото")}
                                  >
                                    <X size={10} />
                                  </button>
                                  {sendingMedia && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                      <Spinner className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Render pendingVideo */}
                              {pendingVideo && (
                                <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-955 shadow-sm">
                                  <video src={pendingVideo.previewUrl} muted playsInline className="h-full w-full object-cover" />
                                  <div className="absolute left-1 bottom-1 rounded-md bg-black/60 p-0.5 text-white">
                                    <SquarePlay size={10} />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (pendingVideo.previewUrl) URL.revokeObjectURL(pendingVideo.previewUrl);
                                      setPendingVideo(null);
                                    }}
                                    className="absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                                    aria-label={t("Убрать видео")}
                                  >
                                    <X size={10} />
                                  </button>
                                  {sendingMedia && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                      <Spinner className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Render pendingAudio */}
                              {pendingAudio && (
                                <div className="relative flex min-h-[46px] w-full items-center gap-3 px-1 py-0.5">
                                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast,#ffffff)] shadow-sm">
                                    <Music size={18} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-medium text-zinc-100 truncate leading-tight">{pendingAudio.name}</p>
                                    <p className="text-[12px] text-zinc-400 truncate mt-0.5">
                                      {pendingAudio.durationMs > 0 ? formatDurationFromSeconds(pendingAudio.durationMs / 1000) : t("Аудиозапись")}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setPendingAudio(null)}
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                    aria-label={t("Убрать музыку")}
                                  >
                                    <X size={15} />
                                  </button>
                                  {sendingMedia && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[16px] backdrop-blur-[1px]">
                                      <Spinner className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Render pendingFile */}
                              {pendingFile && (() => {
                                const ext = (pendingFile.name?.includes(".") ? pendingFile.name.split(".").pop()?.toLowerCase() : "") || "file";
                                const isPdf = ext === "pdf";
                                const isApk = ext === "apk";
                                const isDoc = ext === "doc" || ext === "docx" || ext === "txt" || ext === "rtf";
                                const isZip = ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz";
                                const badgeColor = isPdf
                                  ? "bg-red-500 text-white"
                                  : isApk
                                    ? "bg-emerald-500 text-white"
                                    : isDoc
                                      ? "bg-blue-500 text-white"
                                      : isZip
                                        ? "bg-amber-500 text-white"
                                        : "bg-indigo-500 text-white";

                                return (
                                  <div className="relative flex min-h-[46px] w-full items-center gap-3 px-1 py-0.5">
                                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[11.5px] font-bold uppercase tracking-wider shadow-sm", badgeColor)}>
                                      {ext.slice(0, 4)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[14px] font-medium text-zinc-100 truncate leading-tight">{pendingFile.name}</p>
                                      <p className="text-[12px] text-zinc-400 truncate mt-0.5">{formatFileSize(pendingFile.size)}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setPendingFile(null)}
                                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                      aria-label={t("Убрать файл")}
                                    >
                                      <X size={15} />
                                    </button>
                                    {sendingMedia && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[16px] backdrop-blur-[1px]">
                                        <Spinner className="h-4 w-4 text-white" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {voiceRecording || videoRecording ? (
                        <div className="flex h-9 w-full items-center gap-2.5 px-3 md:h-10 md:px-3.5">
                          <MediaRecordingBar
                            stream={voiceRecording ? voiceRecordingStream : videoRecordingStream}
                            active={voiceRecording || videoRecording}
                            durationMs={voiceRecording ? voiceRecordingMs : videoRecordingMs}
                            captureSamplesRef={voiceRecording ? voiceWaveformSamplesRef : undefined}
                            onCancel={() => {
                              if (voiceRecording) {
                                cancelVoiceRecording();
                              } else {
                                cancelVideoRecording();
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="relative flex min-w-0 flex-1 items-center rounded-[22px] border-0 bg-transparent px-2.5 transition-colors md:rounded-[24px] md:px-3">
                          <div className="relative flex-1 min-w-0">
                            <EmojiComposer
                              ref={messageInputRef}
                              aria-label={isEclipseConversation ? eclipseBots.state?.step === "name" ? t("Имя бота") : eclipseBots.state?.step === "username" ? t("Юзернейм бота") : t("Сообщение Eclipse") : undefined}
                              value={messageText}
                              onValueChange={setMessageText}
                              onFocus={() => {
                                if (preventPickerCloseOnFocusRef.current) {
                                  preventPickerCloseOnFocusRef.current = false;
                                } else {
                                  setStickerPickerOpen(false);
                                }
                                if (isDesktop) return;
                                if (typeof window !== "undefined") {
                                  window.scrollTo(0, 0);
                                  document.documentElement.scrollTop = 0;
                                  if (document.body) document.body.scrollTop = 0;
                                }
                                messagesAtBottomRef.current = true;
                                requestAnimationFrame(() => {
                                  scrollMessagesToBottom("auto");
                                });
                                window.setTimeout(() => {
                                  if (typeof window !== "undefined") {
                                    window.scrollTo(0, 0);
                                    document.documentElement.scrollTop = 0;
                                    if (document.body) document.body.scrollTop = 0;
                                  }
                                  scrollMessagesToBottom("auto");
                                }, 180);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if ((e.nativeEvent as any)?.isComposing) return;
                                  if (chatUiSettings.sendOnEnter && !e.shiftKey) {
                                    e.preventDefault();
                                    if (sending || sendingMedia || sendingMessageInFlightRef.current) return;
                                    void sendMessage();
                                  }
                                }
                              }}
                              placeholder={
                                isEclipseConversation
                                  ? ["name", "name_edit"].includes(eclipseBots.state?.step ?? "") ? t("Введите имя бота")
                                    : ["username", "username_edit"].includes(eclipseBots.state?.step ?? "") ? t("Введите уникальное имя бота")
                                      : eclipseBots.state?.step === "avatar" ? t("Добавьте аватар или пропустите")
                                        : eclipseBots.state?.step === "mine" ? t("Выберите бота")
                                          : eclipseBots.state?.step === "delete_confirm" ? t("Подтвердите удаление или отмените")
                                            : eclipseBots.state?.step === "api_token" ? t("Управление токеном")
                                              : eclipseBots.state?.step === "settings" ? t("Настройки бота")
                                                : eclipseBots.state?.step === "detail" ? t("Выберите действие")
                                                  : eclipseBots.menuOpen ? t("Выберите раздел") : t("Сообщение")
                                  : editTarget
                                    ? t("Редактировать сообщение...")
                                    : pendingMediaBatch?.length
                                      ? t("Подпись к медиа...")
                                      : activeConversation?.chatType === "channel"
                                        ? pendingImage
                                          ? t("Подпись к фото...")
                                          : pendingVideo
                                            ? t("Подпись к видео...")
                                            : pendingAudio
                                              ? t("Подпись к музыке...")
                                              : pendingFile
                                                ? t("Подпись к файлу...")
                                                : t("Публикация")
                                        : isManagedBotConversation ? botChatUi.settings.input_placeholder : t("Сообщение")
                              }
                              className="w-full rounded-none border-0 !border-transparent !bg-transparent pl-2 pr-1.5 py-2 md:py-2.5 font-sans text-[16px] md:text-[15px] font-medium leading-5 text-zinc-100 shadow-none outline-none placeholder:text-zinc-400 focus-visible:!border-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0 dark:!bg-transparent no-scrollbar overflow-y-auto"
                            />
                          </div>
                          {activeConversation?.chatType === "direct" && activeConversation.peer?.isBot && activeChat?.link && !isSecretChat && (
                            <BotMenuToggle controller={botChatUi} onMessage={text => { void sendPreparedMessage(text, { resetComposer: false }); }} />
                          )}
                          {isEclipseConversation && (
                            <button type="button"
                              aria-label={eclipseBots.menuOpen ? t("Закрыть меню Eclipse") : t("Открыть меню Eclipse")}
                              aria-expanded={eclipseBots.menuOpen} aria-controls="eclipse-bot-menu"
                              onClick={() => { eclipseBots.setMenuOpen(value => !value); setStickerPickerOpen(false); setAttachmentMenuOpen(false); }}
                              className={cn("h-7 w-7 md:h-7.5 md:w-7.5 shrink-0 rounded-full bg-transparent p-0 transition-colors hover:bg-white/8 active:scale-95 flex items-center justify-center composer-inline-action self-end mb-1 md:mb-[5px] mr-1", eclipseBots.menuOpen ? "text-zinc-100 bg-white/10" : "text-zinc-400 hover:text-zinc-100")}
                            ><CgMenuRound size={18} className="shrink-0" /></button>
                          )}
                          <button
                            type="button"
                            data-sticker-picker-toggle="true"
                            onClick={() => {
                              setAttachmentMenuOpen(false);
                              if (isEclipseConversation) eclipseBots.setMenuOpen(false);
                              setStickerPickerOpen((prev) => {
                                const next = !prev;
                                if (next) {
                                  messageInputRef.current?.blur();
                                } else {
                                  messageInputRef.current?.focus();
                                }
                                return next;
                              });
                            }}
                            disabled={syncing || editSaving}
                            className={cn(
                              "h-7 w-7 md:h-7.5 md:w-7.5 shrink-0 rounded-full bg-transparent p-0 transition-colors hover:bg-white/8 active:scale-95 flex items-center justify-center composer-inline-action self-end mb-1 md:mb-[5px]",
                              stickerPickerOpen ? "text-zinc-100 bg-white/10" : "text-zinc-400 hover:text-zinc-100",
                            )}
                            aria-label={t("Открыть стикеры и эмодзи")}
                          >
                            <Smile size={16.5} className="shrink-0" />
                          </button>
                        </div>
                      )}
                    </div>

                    {!isSecretChatAcceptRequired && !isSecretChatComposerBlocked && (
                      <>
                        {voiceRecording || videoRecording ? (
                          <div className="relative flex flex-col items-center">
                            {videoRecording && (
                              <motion.button
                                type="button"
                                onClick={() => void flipVideoCamera()}
                                disabled={videoCameraSwitching}
                                aria-busy={videoCameraSwitching}
                                initial={{ scale: 0.7, opacity: 0, y: 8 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.7, opacity: 0, y: 8 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                whileTap={{ scale: 0.92 }}
                                className="pointer-events-auto absolute bottom-[calc(100%+10px)] z-50 composer-round-action h-[38px] w-[38px] md:h-[42px] md:w-[42px] rounded-full border border-white/15 bg-[#18181b] text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:bg-zinc-800 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                aria-label={t("Перевернуть камеру")}
                                title={t("Перевернуть камеру")}
                              >
                                {videoCameraSwitching ? <Spinner className="h-[15px] w-[15px]" /> : <FaArrowsRotate size={15} />}
                              </motion.button>
                            )}
                            <motion.button
                              type="button"
                              onClick={() => {
                                if (voiceRecording) {
                                  void finishVoiceRecording(true);
                                } else {
                                  void finishVideoRecording(true);
                                }
                              }}
                              initial={{ scale: 0.74, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.82, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 360, damping: 23, mass: 0.72 }}
                              whileTap={{ scale: 0.92 }}
                              className={cn(
                                "composer-round-action h-[38px] w-[38px] shrink-0 flex items-center justify-center rounded-full border-0 outline-none ring-0 md:h-[42px] md:w-[42px] cursor-pointer active:scale-95 disabled:opacity-55",
                                composerSendButtonToneClassName,
                              )}
                              style={composerSendButtonStyle}
                              aria-label={t("Отправить запись")}
                            >
                              <IoSend size={16} />
                            </motion.button>
                          </div>
                        ) : forwardDraft || editTarget || messageText.trim() || pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile ? (
                          <Button
                            variant="ghost"
                            onClick={() => void sendMessage()}
                            aria-label={editTarget ? t("Сохранить изменения") : t("Отправить сообщение")}
                            disabled={
                              syncing ||
                              forwardSending ||
                              sending ||
                              sendingMedia ||
                              sendingMessageInFlightRef.current ||
                              !canSubmitMessage ||
                              (activeConversation?.chatType === "direct" && !activeConversation.peer?.isBot &&
                                (!privateKey || !selfPublicKey || !activeConversation?.peer?.publicKey))
                            }
                            className={cn(
                              "composer-round-action h-[38px] w-[38px] shrink-0 rounded-full border-0 p-0 md:h-[42px] md:w-[42px] flex items-center justify-center active:scale-95 disabled:opacity-55 cursor-pointer",
                              composerSendButtonToneClassName,
                            )}
                            style={composerSendButtonStyle}
                          >
                            {editTarget ? <Check size={20} strokeWidth={2.5} /> : <IoSend size={16} />}
                          </Button>
                        ) : (
                          <div className="relative">
                            <RecordingModeHint mode={composerRecordMode} until={recordModeHintUntil} transparent={transparentVisual} />
                            <Button
                              ref={micRecordButtonRef}
                              type="button"
                              variant="ghost"
                              size="icon"
                              onPointerDown={handleMicPointerDown}
                              onPointerMove={handleMicPointerMove}
                              onPointerUp={handleMicPointerUp}
                              onPointerCancel={handleMicPointerCancel}
                              onClick={handleMicClick}
                              onContextMenu={(event) => event.preventDefault()}
                              disabled={syncing}
                              className={cn(
                                "relative composer-round-action h-[38px] w-[38px] shrink-0 touch-none select-none overflow-hidden rounded-full border-0 p-0 md:h-[42px] md:w-[42px] flex items-center justify-center active:scale-95 disabled:opacity-55 cursor-pointer",
                                composerSendButtonToneClassName,
                              )}
                              style={composerSendButtonStyle}
                              aria-label={composerRecordMode === "voice" ? t("Голосовые сообщения") : t("Видеокружки")}
                            >
                              <AnimatePresence initial={false}>
                                <motion.span
                                  key={composerRecordMode}
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                                  initial={{ opacity: 0, scale: 0.75 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.75 }}
                                  transition={{ duration: reducedPanelMotion ? 0 : 0.18, ease: "easeOut" }}
                                >
                                  {composerRecordMode === "voice" ? <RiMicFill className="size-[17px]" /> : <AiFillCamera className="size-[17px]" />}
                                </motion.span>
                              </AnimatePresence>
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

          </>
        )}
        {isEclipseConversation && <EclipseBotMenu controller={eclipseBots} material={composerInputThemeStyle} />}
        {isManagedBotConversation && messages.length > 0 && <BotReplyMenu controller={botChatUi} material={composerInputThemeStyle} onMessage={text => { void sendPreparedMessage(text, { resetComposer: false }); }} onUrl={openExternalLinkPrompt} />}
      </div>
    </footer>
  );
});
