"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Smile } from "lucide-react";
import { PiStickerBold } from "react-icons/pi";
import { useTranslation } from "@/components/LocaleProvider";
import TextEmojiPicker from "@/components/TextEmojiPicker";
import AccountPackPicker from "@/components/AccountPackPicker";
import { cn } from "@/lib/utils";
import type { PackItem } from "@/lib/imported-packs";

export function StoryPackPicker({ onClose, onEmoji, onSticker, initialTab }: {
  onClose: () => void;
  onEmoji: (value: string) => void;
  onSticker: (item: PackItem) => void;
  initialTab: "emoji" | "sticker";
}) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", dismiss, true);
    return () => window.removeEventListener("keydown", dismiss, true);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center px-2 pb-[max(8px,env(safe-area-inset-bottom))]"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-black/20"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .16 }} />
      <motion.div role="dialog" aria-label={t(tab === "emoji" ? "Эмодзи" : "Стикеры")} data-story-pack-picker data-app-panel
        initial={{ y: reduced ? 0 : 16 }} animate={{ y: 0 }} exit={{ y: reduced ? 0 : 12 }}
        transition={{ duration: reduced ? 0 : .18, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[min(292px,48dvh)] w-full max-w-[360px] flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#181818]/72 px-3 pt-1.5 text-zinc-100 shadow-[0_12px_32px_rgba(0,0,0,.34)] backdrop-blur-[16px]">
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "emoji" ? <TextEmojiPicker mobile onSelect={onEmoji} /> : (
            <AccountPackPicker kind="sticker" showRecent mobile onSticker={onSticker} />
          )}
        </div>
        <div className="flex h-11 shrink-0 items-center justify-center gap-1">
          {(["emoji", "sticker"] as const).map(kind => (
            <button key={kind} type="button" aria-pressed={tab === kind}
              aria-label={t(kind === "emoji" ? "Эмодзи" : "Стикеры")} onClick={() => setTab(kind)}
              className={cn("grid h-8 w-10 place-items-center rounded-full transition-colors duration-150",
                tab === kind ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
              {kind === "emoji" ? <Smile size={17} /> : <PiStickerBold size={18} />}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
