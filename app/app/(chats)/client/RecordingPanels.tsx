"use client";
import { FailedMessageActions } from "../components/common/FailedMessageActions";

/* eslint-disable @next/next/no-img-element */
import { type DecryptedMessage, type ParsedMessageContent, type MessageReadViewer, type StoryReplyTarget } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { CSSProperties, memo } from "react";
import { ChevronDown, ChevronLeft, Eye } from "lucide-react";
import { BsPinAngleFill } from "react-icons/bs";
import { useMessagePins } from "../hooks/useMessagePins";
import { IoCopy, IoArrowRedo } from "react-icons/io5";
import { GrRadialSelected } from "react-icons/gr";
import { FaReply } from "react-icons/fa";
import { MdDelete, MdEdit } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageHelperPages } from "../components/common/MessageHelperPages";
import { renderTextWithEmojis } from "./message-content";
import { formatMessageTimeLabel } from "./message-presentation";

export interface RecordingPanelsProps {
  messageHelperId: string | null;
  helperMessage: DecryptedMessage | null;
  helperParsed: ParsedMessageContent | null;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  isCoarsePointer: boolean;
  t: (source: string, values?: TranslationValues | undefined) => string;
  reactionHelperWidth: number;
  messageHelperAnchor: { top: number; bottom: number; left: number; right: number; width: number; height: number; isMine: boolean; } | null;
  helperIsMine: boolean;
  desktopMessageHelperRef: React.RefObject<HTMLDivElement | null>;
  isSecretChat: boolean;
  hasAllowedReactions: boolean;
  messageHelperAllReactionsOpen: boolean;
  composerInputThemeStyle: React.CSSProperties;
  reactionGridWidth: number;
  reactionGridColumns: number;
  allowedReactionEmojis: string[];
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  setMessageHelperAllReactionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  reducedPanelMotion: boolean | null;
  helperReactionEmojis: string[];
  hasMoreReactions: boolean;
  messageHelperReadListOpen: boolean;
  setMessageHelperReadListOpen: React.Dispatch<React.SetStateAction<boolean>>;
  helperReadViewers: MessageReadViewer[];
  helperReadPreviewViewers: MessageReadViewer[];
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  helperCanCopy: boolean;
  copyMessageText: (value: string) => Promise<void>;
  helperCopyValue: string;
  messagePins: ReturnType<typeof useMessagePins>;
  selectedLink: string | null;
  beginForwardMessages: (source: DecryptedMessage[]) => void;
  helperIsEditable: boolean;
  editSaving: boolean;
  helperEditTargetId: string | null;
  beginEditMessage: (message: DecryptedMessage, parsed: ParsedMessageContent) => void;
  beginSelectionMode: (messageId: string) => void;
  removingMessageIds: Set<string>;
  helperCanDelete: boolean;
  deleteMessage: (messageId: string) => Promise<void>;
  renderCenteredMessageHelperPreview: () => React.JSX.Element | null;
}

export const RecordingPanels = memo(function RecordingPanels({ messageHelperId, helperMessage, helperParsed, setMessageHelperId, isCoarsePointer, t, reactionHelperWidth, messageHelperAnchor, helperIsMine, desktopMessageHelperRef, isSecretChat, hasAllowedReactions, messageHelperAllReactionsOpen, composerInputThemeStyle, reactionGridWidth, reactionGridColumns, allowedReactionEmojis, toggleReaction, setMessageHelperAllReactionsOpen, reducedPanelMotion, helperReactionEmojis, hasMoreReactions, messageHelperReadListOpen, setMessageHelperReadListOpen, helperReadViewers, helperReadPreviewViewers, setStoryReplyTarget, setReplyToMessageId, helperCanCopy, copyMessageText, helperCopyValue, messagePins, selectedLink, beginForwardMessages, helperIsEditable, editSaving, helperEditTargetId, beginEditMessage, beginSelectionMode, removingMessageIds, helperCanDelete, deleteMessage, renderCenteredMessageHelperPreview }: RecordingPanelsProps) {
  return (
    <AnimatePresence>
      {messageHelperId && helperMessage && helperParsed ? (
        <>
          {/* Backdrop: transparent on PC (no blur), blurred on mobile */}
          <motion.button
            type="button"
            key="message-helper-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={() => setMessageHelperId(null)}
            className={cn(
              "fixed inset-0 z-40 cursor-default",
              isCoarsePointer ? "bg-black/50 backdrop-blur-[14px]" : "bg-transparent"
            )}
            aria-label={t("Закрыть хелпер сообщения")}
          />

          {!isCoarsePointer ? (
            /* PC Telegram-style adjacent floating popup */
            (() => {
              const menuWidth = Math.max(208, reactionHelperWidth);
              const estimatedHeight = 240;
              const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
              const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

              let left = 0;
              let top = 0;

              const anchor = messageHelperAnchor || (typeof document !== "undefined" && helperMessage ? (() => {
                const el = document.querySelector(`[data-message-id="${helperMessage.id}"] [data-message-helper-anchor="true"]`) as HTMLElement;
                if (el) {
                  const r = el.getBoundingClientRect();
                  return {
                    top: r.top,
                    bottom: r.bottom,
                    left: r.left,
                    right: r.right,
                    width: r.width,
                    height: r.height,
                    isMine: helperIsMine,
                  };
                }
                return null;
              })() : null);

              if (anchor) {
                if (helperIsMine) {
                  left = anchor.left - menuWidth - 8;
                  if (left < 16) {
                    left = Math.max(16, anchor.right - menuWidth);
                  }
                } else {
                  left = anchor.right + 8;
                  if (left + menuWidth > viewportW - 16) {
                    left = Math.max(16, anchor.left);
                  }
                }

                top = anchor.top;
                if (top + estimatedHeight > viewportH - 75) {
                  top = Math.max(16, viewportH - estimatedHeight - 75);
                }
                if (top < 65) top = 65;
              } else {
                left = helperIsMine ? viewportW - menuWidth - 80 : 80;
                top = viewportH / 2 - 120;
              }

              const openDownwards = top < 240;

              return (
                <motion.div
                  key="desktop-message-helper"
                  ref={desktopMessageHelperRef}
                  data-message-helper="true"
                  initial={{ opacity: 0, scale: 0.94, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 4 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  style={{
                    position: "fixed",
                    left: `${Math.round(left)}px`,
                    top: `${Math.round(top)}px`,
                    width: `${menuWidth}px`,
                    zIndex: 50,
                  }}
                  className="flex flex-col gap-1.5 pointer-events-auto select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Reactions Row with Absolute Full Reactions Popup */}
                  <div className="relative inline-flex w-fit max-w-full" style={isSecretChat || !hasAllowedReactions || helperMessage.sendFailure || helperMessage.pending ? { display: "none" } : undefined}>
                    <AnimatePresence>
                      {messageHelperAllReactionsOpen && (
                        <motion.div
                          layout="size"
                          data-reaction-picker="all"
                          initial={{ opacity: 0, scale: 0.92, y: openDownwards ? -6 : 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: openDownwards ? -6 : 6 }}
                          transition={{ type: "spring", stiffness: 450, damping: 28 }}
                          className={cn(
                            openDownwards ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]",
                            "absolute z-50 max-w-[calc(100vw-24px)] max-h-[220px] overflow-y-auto no-scrollbar rounded-[22px] border border-white/10 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                            openDownwards
                              ? ((helperIsMine || (left + 272 > viewportW - 20)) ? "right-0 origin-top-right" : "left-0 origin-top-left")
                              : ((helperIsMine || (left + 272 > viewportW - 20)) ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left")
                          )}
                          style={{ ...composerInputThemeStyle, width: reactionGridWidth }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid justify-items-center gap-1" style={{ gridTemplateColumns: `repeat(${reactionGridColumns}, minmax(0, 1fr))` }}>
                            {allowedReactionEmojis.map((emoji) => (
                              <motion.button
                                key={emoji}
                                type="button"
                                data-reaction-button="true"
                                onClick={() => {
                                  void toggleReaction(helperMessage.id, emoji);
                                  setMessageHelperId(null);
                                  setMessageHelperAllReactionsOpen(false);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[20px] leading-none transition-transform hover:scale-125 hover:bg-white/10 active:scale-90 cursor-pointer"
                                whileTap={{ scale: 0.85 }}
                                title={emoji}
                              >
                                {renderTextWithEmojis(emoji, { size: 20 })}
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      layout="size" data-reaction-picker="quick"
                      transition={{ layout: { duration: reducedPanelMotion ? 0 : 0.18 } }}
                      className="inline-flex flex-none items-center gap-1 rounded-[18px] border border-white/8 bg-[#18181a]/95 px-1.5 py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl [&>button]:shrink-0"
                      style={{ ...composerInputThemeStyle, width: reactionHelperWidth }}
                    >
                      {helperReactionEmojis.map((emoji) => (
                        <motion.button
                          key={`${helperMessage.id}-${emoji}-desktop`}
                          type="button"
                          data-reaction-button="true"
                          onClick={() => {
                            void toggleReaction(helperMessage.id, emoji);
                            setMessageHelperId(null);
                            setMessageHelperAllReactionsOpen(false);
                          }}
                          className="flex h-7.5 w-7.5 items-center justify-center rounded-full text-[18px] leading-none text-white transition hover:bg-white/10 cursor-pointer"
                          whileTap={{ scale: 0.88 }}
                          whileHover={{ scale: 1.18 }}
                        >
                          {renderTextWithEmojis(emoji)}
                        </motion.button>
                      ))}
                      <motion.button
                        type="button"
                        data-reaction-button="true"
                        data-message-helper="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setMessageHelperAllReactionsOpen((prev) => !prev);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        className={cn(
                          "flex h-7.5 w-7.5 items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0",
                          messageHelperAllReactionsOpen ? "bg-white/20 text-white" : "bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
                        )}
                        whileTap={{ scale: 0.88 }}
                        whileHover={{ scale: 1.15 }}
                        style={{ display: hasMoreReactions ? undefined : "none" }}
                        title={t("Все реакции")}
                      >
                        <ChevronDown
                          size={17}
                          strokeWidth={2.4}
                          className={cn("transition-transform duration-200", messageHelperAllReactionsOpen ? "rotate-180 text-white" : "rotate-0 text-zinc-300")}
                        />
                      </motion.button>
                    </motion.div>
                  </div>
                  {/* Action Menu */}
                  <AnimatePresence>
                    {(!messageHelperAllReactionsOpen || isSecretChat || !hasAllowedReactions || helperMessage.sendFailure || helperMessage.pending) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="flex min-h-0 w-full flex-col gap-0.5 overflow-y-auto no-scrollbar rounded-[18px] border border-white/8 bg-[#18181a]/95 p-1 text-zinc-100 shadow-[0_18px_42px_rgba(0,0,0,0.55)] backdrop-blur-xl [&>button]:shrink-0"
                        style={composerInputThemeStyle}
                      >
                        <MessageHelperPages showingReaders={messageHelperReadListOpen} readers={(
                          <>
                            <div className="flex h-9 items-center gap-2 px-1.5">
                              <button
                                type="button"
                                onClick={() => setMessageHelperReadListOpen(false)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
                                aria-label={t("Назад к действиям")}
                              >
                                <ChevronLeft size={18} />
                              </button>
                              <div className="min-w-0 flex-1 text-[13.5px] font-semibold text-zinc-100">
                                {t("Просмотрено ")}{helperReadViewers.length}
                              </div>
                            </div>
                            <div className="mx-2 h-px bg-white/10" />
                            <div className="flex max-h-[min(46vh,320px)] flex-col overflow-y-auto py-1">
                              {helperReadViewers.map((viewer) => (
                                <div
                                  key={`${helperMessage.id}-read-list-${viewer.id}`}
                                  className="flex min-h-10 items-center gap-2 rounded-[12px] px-2 py-1"
                                >
                                  {viewer.avatarUrl ? (
                                    <img
                                      src={viewer.avatarUrl}
                                      alt=""
                                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-zinc-200">
                                      {viewer.displayName.trim().slice(0, 1).toUpperCase() || "?"}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-medium text-zinc-100">
                                      {viewer.displayName}
                                    </div>
                                    <div className="truncate text-[11px] text-zinc-400">
                                      {t("Просмотрено в ")}{formatMessageTimeLabel(viewer.readAt)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )} actions={helperMessage.sendFailure ? <FailedMessageActions message={helperMessage} close={() => setMessageHelperId(null)} onDelete={() => deleteMessage(helperMessage.id)} /> : (
                          <>
                            {helperReadViewers.length > 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setMessageHelperReadListOpen(true)}
                                  className="flex h-9 w-full items-center justify-between gap-2.5 rounded-[12px] px-2.5 text-left text-zinc-100 transition hover:bg-white/10 hover:text-white cursor-pointer"
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <Eye size={18} className="shrink-0 text-white/80" />
                                    <span className="truncate text-[13.5px] font-medium">
                                      {t("Просмотрено ")}{helperReadViewers.length}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center pl-2">
                                    {helperReadPreviewViewers.map((viewer, index) => (
                                      <span
                                        key={`${helperMessage.id}-read-preview-${viewer.id}`}
                                        className="-ml-2 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-950 bg-zinc-800 text-[10px] font-semibold text-zinc-200 first:ml-0"
                                        style={{ zIndex: helperReadPreviewViewers.length - index }}
                                      >
                                        {viewer.avatarUrl ? (
                                          <img
                                            src={viewer.avatarUrl}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          viewer.displayName.trim().slice(0, 1).toUpperCase() || "?"
                                        )}
                                      </span>
                                    ))}
                                  </span>
                                </button>
                                <div className="mx-2 my-0.5 h-px bg-white/10" />
                              </>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStoryReplyTarget(null);
                                setReplyToMessageId(helperMessage.id);
                                setMessageHelperId(null);
                              }}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-colors cursor-pointer"
                            >
                              <FaReply size={16} className="shrink-0 text-white/80" />
                              {t("Ответить")}</Button>
                            {!(!helperCanCopy) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!helperCanCopy}
                              onClick={() => void copyMessageText(helperCopyValue)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white disabled:opacity-40 active:scale-[0.98] transition-colors cursor-pointer"
                            >
                              <IoCopy size={17} className="shrink-0 text-white/80" />
                              {t("Скопировать")}</Button>)}
                            {!(!messagePins.canManage || messagePins.busy || helperMessage.id.startsWith("optimistic:")) && (<Button type="button" variant="ghost" size="sm" disabled={!messagePins.canManage || messagePins.busy || helperMessage.id.startsWith("optimistic:")} onClick={() => { setMessageHelperId(null); void messagePins.toggle((helperMessage!).id); }} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><BsPinAngleFill size={17} className="shrink-0" />{messagePins.pins.some(pin => pin.id === (helperMessage!).id) ? t("Открепить") : t("Закрепить")}</Button>)}
                            {!(Boolean(selectedLink?.startsWith("secret-"))) && (<Button type="button" variant="ghost" size="sm" disabled={Boolean(selectedLink?.startsWith("secret-"))} onClick={() => beginForwardMessages([helperMessage!])} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><IoArrowRedo size={17} />{t("Переслать")}</Button>)}
                            {!(!helperIsEditable || editSaving || (helperEditTargetId !== null && helperEditTargetId !== helperMessage.id)) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!helperIsEditable || editSaving || (helperEditTargetId !== null && helperEditTargetId !== helperMessage.id)}
                              onClick={() => beginEditMessage(helperMessage, helperParsed)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white disabled:opacity-40 active:scale-[0.98] transition-colors cursor-pointer"
                            >
                              <MdEdit size={18} className="shrink-0 text-white/80" />
                              {t("Редактировать")}</Button>)}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => beginSelectionMode(helperMessage.id)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-colors cursor-pointer"
                            >
                              <GrRadialSelected size={17} className="shrink-0 text-white/80" />
                              {t("Выбрать")}</Button>
                            {!(removingMessageIds.has(helperMessage.id) || !helperCanDelete) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={removingMessageIds.has(helperMessage.id) || !helperCanDelete}
                              onClick={() => void deleteMessage(helperMessage.id)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-red-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40 active:scale-[0.98] transition-colors cursor-pointer"
                            >
                              <MdDelete size={19} className="shrink-0" />
                              {removingMessageIds.has(helperMessage.id) ? t("Удаление...") : t("Удалить")}
                            </Button>)}
                          </>
                        )} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })()
          ) : (
            /* Mobile centered view */
            <motion.div
              key="centered-message-helper"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="absolute inset-0 z-50 flex items-start overflow-y-auto overflow-x-hidden px-2.5 py-6 md:px-6 lg:px-7"
            >
              <div className={`mx-auto my-auto flex w-full max-w-[920px] ${helperIsMine ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[min(100%,440px)] flex-col ${helperIsMine ? "items-end" : "items-start"}`}>
                  {/* Mobile Reactions Row with Absolute Full Reactions Popup */}
                  <div className="relative inline-flex w-fit max-w-full" style={isSecretChat || !hasAllowedReactions || helperMessage.sendFailure || helperMessage.pending ? { display: "none" } : undefined}>
                    <AnimatePresence>
                      {messageHelperAllReactionsOpen && (
                        <motion.div
                          layout="size"
                          data-reaction-picker="all"
                          data-message-helper="true"
                          initial={{ opacity: 0, scale: 0.92, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: 6 }}
                          transition={{ type: "spring", stiffness: 450, damping: 28 }}
                          className={cn(
                            "absolute bottom-[calc(100%+8px)] z-50 max-w-[calc(100vw-24px)] max-h-[220px] overflow-y-auto no-scrollbar rounded-[22px] border border-white/10 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                            helperIsMine ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"
                          )}
                          style={{ ...composerInputThemeStyle, width: reactionGridWidth }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid justify-items-center gap-1" style={{ gridTemplateColumns: `repeat(${reactionGridColumns}, minmax(0, 1fr))` }}>
                            {allowedReactionEmojis.map((emoji) => (
                              <motion.button
                                key={emoji}
                                type="button"
                                data-reaction-button="true"
                                onClick={() => {
                                  void toggleReaction(helperMessage.id, emoji);
                                  setMessageHelperId(null);
                                  setMessageHelperAllReactionsOpen(false);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[20px] leading-none transition-transform hover:scale-125 hover:bg-white/10 active:scale-90 cursor-pointer"
                                whileTap={{ scale: 0.85 }}
                                title={emoji}
                              >
                                {renderTextWithEmojis(emoji, { size: 20 })}
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      layout="size" data-reaction-picker="quick"
                      initial={{ opacity: 0, x: -24, clipPath: "inset(0% 100% 0% 0% round 18px)" }}
                      animate={{ opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0% round 18px)" }}
                      exit={{ opacity: 0, x: -16, clipPath: "inset(0% 100% 0% 0% round 18px)" }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                      data-message-helper="true"
                      className="mb-1.5 inline-flex flex-none items-center gap-1 rounded-[18px] border border-white/8 bg-[#18181a]/95 px-1.5 py-1 shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl [&>button]:shrink-0"
                      style={{ ...composerInputThemeStyle, width: reactionHelperWidth }}
                    >
                      {helperReactionEmojis.map((emoji) => (
                        <motion.button
                          key={`${helperMessage.id}-${emoji}-centered`}
                          type="button"
                          data-reaction-button="true"
                          onClick={() => {
                            void toggleReaction(helperMessage.id, emoji);
                            setMessageHelperId(null);
                            setMessageHelperAllReactionsOpen(false);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          className="flex h-7.5 w-7.5 items-center justify-center rounded-full text-[18px] leading-none text-white transition hover:bg-white/10"
                          whileTap={{ scale: 0.88 }}
                          whileHover={isCoarsePointer ? undefined : { scale: 1.18 }}
                        >
                          {renderTextWithEmojis(emoji)}
                        </motion.button>
                      ))}
                      <motion.button
                        type="button"
                        data-reaction-button="true"
                        data-message-helper="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setMessageHelperAllReactionsOpen((prev) => !prev);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        className={cn(
                          "flex h-7.5 w-7.5 items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0",
                          messageHelperAllReactionsOpen ? "bg-white/20 text-white" : "bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
                        )}
                        whileTap={{ scale: 0.88 }}
                        whileHover={isCoarsePointer ? undefined : { scale: 1.15 }}
                        style={{ display: hasMoreReactions ? undefined : "none" }}
                        title={t("Все реакции")}
                      >
                        <ChevronDown
                          size={17}
                          strokeWidth={2.4}
                          className={cn("transition-transform duration-200", messageHelperAllReactionsOpen ? "rotate-180 text-white" : "rotate-0 text-zinc-300")}
                        />
                      </motion.button>
                    </motion.div>
                  </div>

                  <div data-message-helper="true" className="max-w-full">
                    {renderCenteredMessageHelperPreview()}
                  </div>

                  <AnimatePresence>
                    {(!messageHelperAllReactionsOpen || isSecretChat || !hasAllowedReactions || helperMessage.sendFailure || helperMessage.pending) && (
                      <motion.div
                        initial={{ opacity: 0, y: 14, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 440, damping: 27, delay: 0.03 }}
                        data-message-helper="true"
                        className={`mt-1.5 flex w-full max-w-[200px] flex-col gap-0.5 rounded-[18px] border p-1 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.4)] ${helperIsMine ? "self-end" : "self-start"}`}
                        style={composerInputThemeStyle}
                      >
                        <MessageHelperPages showingReaders={messageHelperReadListOpen} readers={(
                          <>
                            <div className="flex h-9 items-center gap-2 px-1.5">
                              <button
                                type="button"
                                onClick={() => setMessageHelperReadListOpen(false)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
                                aria-label={t("Назад к действиям")}
                              >
                                <ChevronLeft size={18} />
                              </button>
                              <div className="min-w-0 flex-1 text-[13.5px] font-semibold text-zinc-100">
                                {t("Просмотрено ")}{helperReadViewers.length}
                              </div>
                            </div>
                            <div className="mx-2 h-px bg-white/10" />
                            <div className="flex max-h-[min(46vh,320px)] flex-col overflow-y-auto py-1">
                              {helperReadViewers.map((viewer) => (
                                <div
                                  key={`${helperMessage.id}-read-list-${viewer.id}`}
                                  className="flex min-h-10 items-center gap-2 rounded-[12px] px-2 py-1"
                                >
                                  {viewer.avatarUrl ? (
                                    <img
                                      src={viewer.avatarUrl}
                                      alt=""
                                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-zinc-200">
                                      {viewer.displayName.trim().slice(0, 1).toUpperCase() || "?"}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-medium text-zinc-100">
                                      {viewer.displayName}
                                    </div>
                                    <div className="truncate text-[11px] text-zinc-400">
                                      {t("Просмотрено в ")}{formatMessageTimeLabel(viewer.readAt)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )} actions={helperMessage.sendFailure ? <FailedMessageActions message={helperMessage} close={() => setMessageHelperId(null)} onDelete={() => deleteMessage(helperMessage.id)} /> : (
                          <>
                            {helperReadViewers.length > 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setMessageHelperReadListOpen(true)}
                                  className="flex h-9 w-full items-center justify-between gap-2.5 rounded-[12px] px-2.5 text-left text-zinc-100 transition hover:bg-white/10 hover:text-white"
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <Eye size={18} className="shrink-0 text-white/80" />
                                    <span className="truncate text-[13.5px] font-medium">
                                      {t("Просмотрено ")}{helperReadViewers.length}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center pl-2">
                                    {helperReadPreviewViewers.map((viewer, index) => (
                                      <span
                                        key={`${helperMessage.id}-read-preview-${viewer.id}`}
                                        className="-ml-2 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-950 bg-zinc-800 text-[10px] font-semibold text-zinc-200 first:ml-0"
                                        style={{ zIndex: helperReadPreviewViewers.length - index }}
                                      >
                                        {viewer.avatarUrl ? (
                                          <img
                                            src={viewer.avatarUrl}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          viewer.displayName.trim().slice(0, 1).toUpperCase() || "?"
                                        )}
                                      </span>
                                    ))}
                                  </span>
                                </button>
                                <div className="mx-2 my-0.5 h-px bg-white/10" />
                              </>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStoryReplyTarget(null);
                                setReplyToMessageId(helperMessage.id);
                                setMessageHelperId(null);
                              }}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-colors"
                            >
                              <FaReply size={16} className="shrink-0 text-white/80" />
                              {t("Ответить")}</Button>
                            {!(!helperCanCopy) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!helperCanCopy}
                              onClick={() => void copyMessageText(helperCopyValue)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white disabled:opacity-40 active:scale-[0.98] transition-colors"
                            >
                              <IoCopy size={17} className="shrink-0 text-white/80" />
                              {t("Скопировать")}</Button>)}
                            {!(!messagePins.canManage || messagePins.busy || helperMessage.id.startsWith("optimistic:")) && (<Button type="button" variant="ghost" size="sm" disabled={!messagePins.canManage || messagePins.busy || helperMessage.id.startsWith("optimistic:")} onClick={() => { setMessageHelperId(null); void messagePins.toggle((helperMessage!).id); }} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><BsPinAngleFill size={17} className="shrink-0" />{messagePins.pins.some(pin => pin.id === (helperMessage!).id) ? t("Открепить") : t("Закрепить")}</Button>)}
                            {!(Boolean(selectedLink?.startsWith("secret-"))) && (<Button type="button" variant="ghost" size="sm" disabled={Boolean(selectedLink?.startsWith("secret-"))} onClick={() => beginForwardMessages([helperMessage!])} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><IoArrowRedo size={17} />{t("Переслать")}</Button>)}
                            {!(!helperIsEditable || editSaving || (helperEditTargetId !== null && helperEditTargetId !== helperMessage.id)) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!helperIsEditable || editSaving || (helperEditTargetId !== null && helperEditTargetId !== helperMessage.id)}
                              onClick={() => beginEditMessage(helperMessage, helperParsed)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white disabled:opacity-40 active:scale-[0.98] transition-colors"
                            >
                              <MdEdit size={18} className="shrink-0 text-white/80" />
                              {t("Редактировать")}</Button>)}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => beginSelectionMode(helperMessage.id)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-colors"
                            >
                              <GrRadialSelected size={17} className="shrink-0 text-white/80" />
                              {t("Выбрать")}</Button>
                            {!(removingMessageIds.has(helperMessage.id) || !helperCanDelete) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={removingMessageIds.has(helperMessage.id) || !helperCanDelete}
                              onClick={() => void deleteMessage(helperMessage.id)}
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-red-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40 active:scale-[0.98] transition-colors"
                            >
                              <MdDelete size={19} className="shrink-0" />
                              {removingMessageIds.has(helperMessage.id) ? t("Удаление...") : t("Удалить")}
                            </Button>)}
                          </>
                        )} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </>
      ) : null}
    </AnimatePresence>
  );
});
