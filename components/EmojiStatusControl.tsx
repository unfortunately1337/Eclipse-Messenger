"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { TbMoodPlus } from "react-icons/tb";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "@/components/LocaleProvider";
import { useEmojiEntry } from "@/lib/client/pack-items";
import { EmojiStatusIcon } from "./EmojiStatusIcon";

const Picker = dynamic(() => import("./EmojiStatusPicker"), { ssr: false });

export function EmojiStatusControl({ value, glass, onChange }: {
  value: string | null; glass: boolean; onChange: (id: string | null) => Promise<void>;
}) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const entry = useEmojiEntry(value);
  const select = async (id: string | null) => {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(null);
    try { await onChange(id); setOpen(false); }
    catch { setError(t("Не удалось сохранить статус. Попробуйте ещё раз.")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <>
    <button ref={triggerRef} type="button" data-emoji-status-trigger aria-label={t("Эмодзи-статус")} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setLoaded(true); setOpen(true); setError(null); }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${entry ? "size-7" : "size-6"}`}>
      {entry ? <EmojiStatusIcon entry={entry} animate={!reduced && !open} size={24} /> : <TbMoodPlus size={19} />}
    </button>
    {loaded && <Picker open={open} onOpenChange={setOpen} value={value} onSelect={id => void select(id)} glass={glass} saving={saving} error={error} triggerRef={triggerRef} />}
  </>;
}
