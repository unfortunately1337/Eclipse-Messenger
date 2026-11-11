"use client";
import { memo } from "react";
import { renderStaticEmojiText } from "@/components/StaticEmojiText";
import { useTranslation } from "@/components/LocaleProvider";


import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMessageTailColor } from "@/lib/message-surface";
import { MessageBubbleTail } from "./MessageBubbles";

export const ChatThemeCard = memo(function ChatThemeCard({ label, emoji = "🎨", background, outgoing, incoming = "#212121", pattern = "/chat-bg-official.svg", selected, create, onClick }: {
  label: string; emoji?: string; background?: string; outgoing?: string; incoming?: string; pattern?: string | null; selected?: boolean; create?: boolean; onClick: () => void;
}) {
  const t = useTranslation();
  const tail = getMessageTailColor({ background: outgoing });
  return <button type="button" aria-label={create ? t("Создать свою тему") : t("Тема: {0}", { 0: label })} aria-pressed={create ? undefined : !!selected}
    onClick={onClick} className={cn("relative flex h-[112px] w-[82px] shrink-0 snap-start flex-col items-center justify-between rounded-[18px] p-2.5 cursor-pointer transition-[border-color,transform] active:scale-95",
      create ? "bg-white/[0.03] hover:bg-white/[0.06]" : "border border-white/10",
      selected && "ring-2 ring-inset ring-white")}
    style={{ background: create ? undefined : background, contain: "paint" }}>
    {!create && pattern && <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.21]" style={{ backgroundImage: `url('${pattern}')`, backgroundSize: "80px auto", filter: "invert(1)" }} />}
    {create ? <span className="grid flex-1 place-items-center text-zinc-300"><Plus size={27} strokeWidth={1.6} /></span> :
      <div aria-hidden className="relative flex w-full flex-1 flex-col justify-center gap-2 px-1">
        <div className="relative h-[20px] w-[42px] self-start rounded-[9px] rounded-bl-none px-2 pt-1.5" style={{ background: incoming }}>
          <MessageBubbleTail compact isMine={false} hasTail fillColor={incoming} className="h-2.5 w-[4.5px] -left-[4px]" />
        </div>
        <div className="relative h-[24px] w-[44px] self-end rounded-[9px] rounded-br-none px-2 pt-1.5" style={{ background: outgoing }}>
          <MessageBubbleTail compact isMine hasTail fillColor={tail} className="h-2.5 w-[4.5px] -right-[4px]" />
        </div>
      </div>}
    {!create && <span aria-hidden className="relative flex h-5 w-full items-center justify-center">{renderStaticEmojiText(emoji, { size: 18 })}</span>}
  </button>;
});
