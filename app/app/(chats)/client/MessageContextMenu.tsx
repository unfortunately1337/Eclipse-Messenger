"use client";

import { type DecryptedMessage, type ParsedMessageContent, type StoryReplyTarget } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { CSSProperties, memo } from "react";
import { BsPinAngleFill } from "react-icons/bs";
import { useMessagePins } from "../hooks/useMessagePins";
import { IoCopy, IoArrowRedo } from "react-icons/io5";
import { GrRadialSelected } from "react-icons/gr";
import { FaReply } from "react-icons/fa";
import { MdDelete, MdEdit } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { renderTextWithEmojis } from "./message-content";

export interface MessageContextMenuProps {
  shouldUseLegacyMessageHelper: false;
  messageHelperId: string | null;
  isCoarsePointer: boolean;
  helperMessage: DecryptedMessage | null;
  helperParsed: ParsedMessageContent | null;
  composerInputThemeStyle: React.CSSProperties;
  isSecretChat: boolean;
  hasAllowedReactions: boolean;
  helperReactionEmojis: string[];
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  messagePins: ReturnType<typeof useMessagePins>;
  selectedLink: string | null;
  beginForwardMessages: (source: DecryptedMessage[]) => void;
  helperIsEditable: boolean;
  editSaving: boolean;
  helperEditTargetId: string | null;
  beginEditMessage: (message: DecryptedMessage, parsed: ParsedMessageContent) => void;
  copyMessageText: (value: string) => Promise<void>;
  beginSelectionMode: (messageId: string) => void;
  removingMessageIds: Set<string>;
  helperCanDelete: boolean;
  deleteMessage: (messageId: string) => Promise<void>;
}

export const MessageContextMenu = memo(function MessageContextMenu({ shouldUseLegacyMessageHelper, messageHelperId, isCoarsePointer, helperMessage, helperParsed, composerInputThemeStyle, isSecretChat, hasAllowedReactions, helperReactionEmojis, toggleReaction, setMessageHelperId, setStoryReplyTarget, setReplyToMessageId, t, messagePins, selectedLink, beginForwardMessages, helperIsEditable, editSaving, helperEditTargetId, beginEditMessage, copyMessageText, beginSelectionMode, removingMessageIds, helperCanDelete, deleteMessage }: MessageContextMenuProps) {
  return (
    <AnimatePresence>
      {shouldUseLegacyMessageHelper && messageHelperId && isCoarsePointer && helperMessage && helperParsed ? (
        <motion.div
          key="mobile-message-helper"
          initial={{ opacity: 0, y: 14, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 440, damping: 27 }}
          className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 md:hidden"
        >
          <div className="flex flex-col items-stretch gap-2">
            <motion.div
              initial={{ opacity: 0, x: -24, clipPath: "inset(0% 100% 0% 0% round 18px)" }}
              animate={{ opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0% round 18px)" }}
              exit={{ opacity: 0, x: -16, clipPath: "inset(0% 100% 0% 0% round 18px)" }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
              data-message-helper="true"
              className="mx-auto inline-flex max-w-full items-center rounded-[18px] border p-1 shadow-[0_14px_40px_rgba(0,0,0,0.4)]"
              style={{ ...composerInputThemeStyle, display: isSecretChat || !hasAllowedReactions ? "none" : undefined }}
            >
              <div className="flex items-center gap-0.5 px-0.5">
                {helperReactionEmojis.map((emoji) => (
                  <motion.button
                    key={`${helperMessage!.id}-${emoji}-mobile`}
                    type="button"
                    data-reaction-button="true"
                    onClick={() => {
                      void toggleReaction(helperMessage!.id, emoji);
                      setMessageHelperId(null);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[19px] leading-none text-white transition hover:bg-white/10"
                    whileTap={{ scale: 0.88 }}
                  >
                    {renderTextWithEmojis(emoji)}
                  </motion.button>
                ))}
              </div>
            </motion.div>
            <div
              data-message-helper="true"
              className="mx-auto flex w-full max-w-[200px] flex-col gap-0.5 rounded-[18px] border p-1 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
              style={composerInputThemeStyle}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStoryReplyTarget(null);
                  setReplyToMessageId(helperMessage!.id);
                  setMessageHelperId(null);
                }}
                className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] transition-all duration-150"
              >
                <FaReply size={16} className="shrink-0 text-white/80" />
                {t("Ответить")}</Button>
              {!(!messagePins.canManage || messagePins.busy || helperMessage.id.startsWith("optimistic:")) && (<Button type="button" variant="ghost" size="sm" disabled={!messagePins.canManage || messagePins.busy || helperMessage.id.startsWith("optimistic:")} onClick={() => { setMessageHelperId(null); void messagePins.toggle((helperMessage!).id); }} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><BsPinAngleFill size={17} className="shrink-0" />{messagePins.pins.some(pin => pin.id === (helperMessage!).id) ? t("Открепить") : t("Закрепить")}</Button>)}
              {!(Boolean(selectedLink?.startsWith("secret-"))) && (<Button type="button" variant="ghost" size="sm" disabled={Boolean(selectedLink?.startsWith("secret-"))} onClick={() => beginForwardMessages([helperMessage!])} className="h-9 w-full justify-start rounded-xl px-2.5 gap-3 text-inherit hover:bg-white/10 disabled:opacity-40"><IoArrowRedo size={17} />{t("Переслать")}</Button>)}
              {!(!helperIsEditable || editSaving || (helperEditTargetId !== null && helperEditTargetId !== helperMessage!.id)) && (<Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!helperIsEditable || editSaving || (helperEditTargetId !== null && helperEditTargetId !== helperMessage!.id)}
                onClick={() => beginEditMessage(helperMessage!, helperParsed!)}
                className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 active:scale-[0.98] transition-all duration-150"
              >
                <MdEdit size={18} className="shrink-0 text-white/80" />
                {t("Редактировать")}</Button>)}
              {!(helperParsed!.kind === "image"
                ? !helperParsed!.caption.trim()
                : helperParsed!.kind === "poll"
                  ? !helperParsed!.question.trim()
                  : helperParsed!.kind === "album"
                    ? !helperParsed!.caption.trim()
                    : helperParsed!.kind === "sticker"
                      ? true
                      : helperParsed!.kind === "voice" || helperParsed!.kind === "video"
                        ? true
                        : helperParsed!.kind === "file"
                          ? !(helperParsed!.caption || helperParsed!.name).trim()
                          : helperParsed!.kind === "music"
                            ? !(helperParsed!.caption || helperParsed!.title).trim()
                            : !helperParsed!.text.trim()) && (<Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={
                                helperParsed!.kind === "image"
                                  ? !helperParsed!.caption.trim()
                                  : helperParsed!.kind === "poll"
                                    ? !helperParsed!.question.trim()
                                    : helperParsed!.kind === "album"
                                      ? !helperParsed!.caption.trim()
                                      : helperParsed!.kind === "sticker"
                                        ? true
                                        : helperParsed!.kind === "voice" || helperParsed!.kind === "video"
                                          ? true
                                          : helperParsed!.kind === "file"
                                            ? !(helperParsed!.caption || helperParsed!.name).trim()
                                            : helperParsed!.kind === "music"
                                              ? !(helperParsed!.caption || helperParsed!.title).trim()
                                              : !helperParsed!.text.trim()
                              }
                              onClick={() =>
                                void copyMessageText(
                                  helperParsed!.kind === "image"
                                    ? helperParsed!.caption
                                    : helperParsed!.kind === "poll"
                                      ? helperParsed!.question
                                      : helperParsed!.kind === "album"
                                        ? helperParsed!.caption
                                        : helperParsed!.kind === "sticker"
                                          ? ""
                                          : helperParsed!.kind === "voice" || helperParsed!.kind === "video"
                                            ? ""
                                            : helperParsed!.kind === "file"
                                              ? (helperParsed!.caption || helperParsed!.name)
                                              : helperParsed!.kind === "music"
                                                ? (helperParsed!.caption || helperParsed!.title)
                                                : helperParsed!.text,
                                )
                              }
                              className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 active:scale-[0.98] transition-all duration-150"
                            >
                              <IoCopy size={17} className="shrink-0 text-white/80" />
                              {t("Скопировать")}</Button>)}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => beginSelectionMode(helperMessage!.id)}
                className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-white/95 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] transition-all duration-150"
              >
                <GrRadialSelected size={17} className="shrink-0 text-white/80" />
                {t("Выбрать")}</Button>
              {!(removingMessageIds.has(helperMessage!.id) || !helperCanDelete) && (<Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingMessageIds.has(helperMessage!.id) || !helperCanDelete}
                onClick={() => void deleteMessage(helperMessage!.id)}
                className="h-9 w-full justify-start rounded-[12px] px-2.5 gap-3 text-[13.5px] font-medium text-red-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40 active:scale-[0.98] transition-all duration-150"
              >
                <MdDelete size={19} className="shrink-0" />
                {removingMessageIds.has(helperMessage!.id) ? t("Удаление...") : t("Удалить")}
              </Button>)}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});
