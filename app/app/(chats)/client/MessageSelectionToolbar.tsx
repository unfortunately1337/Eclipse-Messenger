"use client";

import { MdDelete } from "react-icons/md";
import { IoArrowRedo } from "react-icons/io5";
import { X } from "lucide-react";
import type { ConversationHeaderProps } from "./ConversationHeader";

type Props = Pick<ConversationHeaderProps, "selectedMessageIds" | "selectedMessages" | "selectionDeleting" | "setSelectionDeleteDialogOpen" | "forwardSending" | "selectedLink" | "beginForwardMessages" | "clearSelectionMode" | "composerInputThemeStyle" | "t">;

export function MessageSelectionToolbar({ selectedMessageIds, selectedMessages, selectionDeleting, setSelectionDeleteDialogOpen, forwardSending, selectedLink, beginForwardMessages, clearSelectionMode, composerInputThemeStyle, t }: Props) {
  const action = "pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/8 transition-[color,transform] hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-default disabled:active:scale-100 md:h-10 md:w-10";
  const canForward = selectedMessages.some(message => !message.pending && !message.systemPayload);
  const deleteDisabled = !selectedMessageIds.length || selectionDeleting;
  const forwardDisabled = !canForward || forwardSending || Boolean(selectedLink?.startsWith("secret-"));
  const material = composerInputThemeStyle;
  return <div data-message-selection-toolbar role="toolbar" aria-label={t("Выбранные сообщения")}
    className="pointer-events-none mx-auto grid min-h-[58px] w-full max-w-[700px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 py-1 text-white md:min-h-[54px]">
    <div className="flex justify-start">
      <button type="button" style={material} className={action + " text-red-400 hover:text-red-300"} title={t("Удалить выбранные сообщения")} aria-label={t("Удалить выбранные сообщения")}
        disabled={deleteDisabled} onClick={() => setSelectionDeleteDialogOpen(true)}>
        <MdDelete size={21} className={deleteDisabled ? "opacity-35" : undefined} />
      </button>
    </div>
    <span data-selection-count aria-live="polite" aria-atomic="true" style={material} className="flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-white/8 px-3 text-center text-[13px] font-semibold leading-4 tabular-nums">{t("Выбрано: ")}{selectedMessageIds.length}</span>
    <div className="flex justify-end gap-1">
      <button type="button" style={material} className={action + " text-zinc-300"} title={t("Отменить выделение")} aria-label={t("Отменить выделение")} onClick={clearSelectionMode}>
        <X size={20} />
      </button>
      <button type="button" style={material} className={action + " text-zinc-100"} title={t("Переслать выбранные сообщения")} aria-label={t("Переслать выбранные сообщения")}
        disabled={forwardDisabled} onClick={() => beginForwardMessages(selectedMessages)}>
        <IoArrowRedo size={21} className={forwardDisabled ? "opacity-35" : undefined} />
      </button>
    </div>
  </div>;
}
