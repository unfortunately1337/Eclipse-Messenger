"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMessageTailColor } from "@/lib/message-surface";
import { MessageBubbleTail } from "./MessageBubbles";

export function ChatThemeCard({ label, background, outgoing, incoming = "#212121", pattern = "/chat-bg-official.svg", patternGradient = "rgba(255,255,255,0.6)", selected, create, onClick }: {
  label: string; background?: string; outgoing?: string; incoming?: string; pattern?: string | null; patternGradient?: string; selected?: boolean; create?: boolean; onClick: () => void;
}) {
  const t = useTranslation();
  const tail = getMessageTailColor({ background: outgoing });
  return <button type="button" aria-label={create ? t("Создать свою тему") : t("Тема: {0}", { 0: label })} aria-pressed={create ? undefined : !!selected}
    onClick={onClick} className={cn("relative flex h-[112px] w-[82px] shrink-0 snap-start flex-col items-center justify-between rounded-[18px] p-2.5 cursor-pointer transition-[border-color,transform] active:scale-95",
      create ? "border border-dashed border-zinc-500/70 bg-white/[0.03] hover:border-zinc-300" : "border border-white/10",
      selected && "ring-2 ring-inset ring-white")}
    style={create ? undefined : { background }}>
    {!create && pattern && <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-35" style={{ background: patternGradient, maskImage: `url('${pattern}')`, WebkitMaskImage: `url('${pattern}')`, maskSize: "80px auto", WebkitMaskSize: "80px auto", maskRepeat: "repeat", WebkitMaskRepeat: "repeat" }} />}
    {create ? <span className="grid flex-1 place-items-center text-zinc-300"><Plus size={27} strokeWidth={1.6} /></span> :
      <div aria-hidden className="relative flex w-full flex-1 flex-col justify-center gap-2 px-1">
        <div className="relative h-[20px] w-[42px] self-start rounded-[9px] rounded-bl-none px-2 pt-1.5" style={{ background: incoming }}>
          <MessageBubbleTail compact isMine={false} hasTail fillColor={incoming} className="h-2.5 w-[4.5px] -left-[4px]" />
          <div className="h-[2px] w-6 rounded-full bg-white/30" /><div className="mt-1 h-[2px] w-4 rounded-full bg-white/20" />
        </div>
        <div className="relative h-[24px] w-[44px] self-end rounded-[9px] rounded-br-none px-2 pt-1.5" style={{ background: outgoing }}>
          <MessageBubbleTail compact isMine hasTail fillColor={tail} className="h-2.5 w-[4.5px] -right-[4px]" />
          <div className="h-[2px] w-6 rounded-full bg-black/20" /><div className="mt-1 h-[2px] w-4 rounded-full bg-black/15" />
        </div>
      </div>}
    <span className="relative w-full truncate text-center text-[11px] font-medium text-zinc-200">{label}</span>
  </button>;
}
