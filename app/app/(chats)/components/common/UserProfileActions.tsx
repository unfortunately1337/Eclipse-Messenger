"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { menuPopoverMotion } from "@/lib/client/panel-motion";
import { IoChatbubble, IoCall, IoEllipsisHorizontal, IoImageOutline, IoLockClosedOutline, IoNotifications, IoNotificationsOff, IoSearch } from "react-icons/io5";
import { useTranslation } from "@/components/LocaleProvider";

type Props = {
  muted: boolean;
  glass: boolean;
  callDisabled: boolean;
  uploadingWallpaper: boolean;
  onCall: () => void;
  onToggleSound: () => void;
  onSearch: () => void;
  onChat?: () => void;
  onWallpaper: () => void;
  onSecretChat: () => void;
};

export default function UserProfileActions({ muted, glass, callDisabled, uploadingWallpaper, onCall, onToggleSound, onSearch, onChat, onWallpaper, onSecretChat }: Props) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!moreOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        root.current?.querySelector<HTMLButtonElement>("[aria-expanded]")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [moreOpen]);

  const tile = "grid h-[60px] min-w-0 content-center justify-items-center gap-1 rounded-[18px] border-0 px-1 py-2 text-zinc-300 transition-[background-color,color,transform] duration-200 hover:bg-white/[0.09] hover:text-white active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 disabled:cursor-default disabled:opacity-35";
  const material = { backgroundColor: "rgba(255,255,255,0.04)" };
  const item = "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-[14px] font-medium text-zinc-100 transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-white/50 disabled:opacity-40";

  return (
    <div ref={root} className="relative z-20 mx-4 mb-3 grid grid-cols-4 gap-2" aria-label={t("Действия профиля")}>
      {onChat && <button type="button" className={tile} style={material} onClick={onChat} aria-label={t("Чат")}>
        <IoChatbubble size={22} aria-hidden />
        <span className="max-w-full truncate text-[10.5px] leading-[13px]">{t("Чат")}</span>
      </button>}
      <button type="button" className={tile} style={material} disabled={callDisabled} onClick={onCall} aria-label={t("Позвонить")}>
        <IoCall size={22} aria-hidden />
        <span className="max-w-full truncate text-[10.5px] leading-[13px]">{t("Звонок")}</span>
      </button>
      <button type="button" className={tile} style={material} onClick={onToggleSound} aria-pressed={!muted} aria-label={t(muted ? "Включить звук уведомлений" : "Выключить звук уведомлений")}>
        <span className="relative block h-[22px] w-[22px] shrink-0" aria-hidden>
          <AnimatePresence initial={false}>
            <motion.span key={muted ? "muted" : "sound"} className="absolute inset-0 grid place-items-center" initial={{ opacity: 0, scale: 0.75, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.75, rotate: 12 }} transition={{ duration: 0.18 }}>
              {muted ? <IoNotificationsOff size={22} /> : <IoNotifications size={22} />}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="max-w-full truncate text-[10.5px] leading-[13px]">{t("Звук")}</span>
      </button>
      {!onChat && <button type="button" className={tile} style={material} onClick={onSearch} aria-label={t("Поиск")}>
        <IoSearch size={22} aria-hidden />
        <span className="max-w-full truncate text-[10.5px] leading-[13px]">{t("Поиск")}</span>
      </button>}
      <button type="button" className={tile} style={material} onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen} aria-controls={menuId}>
        <IoEllipsisHorizontal size={22} aria-hidden />
        <span className="max-w-full truncate text-[10.5px] leading-[13px]">{t("Ещё")}</span>
      </button>
      <AnimatePresence>
        {moreOpen && (
          <motion.div id={menuId} className="absolute right-0 top-[calc(100%+8px)] z-50 w-[232px] max-w-full rounded-[22px] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.28)]" style={{ backgroundColor: glass ? "rgba(30,30,32,0.99)" : "#1e1e20" }} {...menuPopoverMotion(reduced)}>
            <button type="button" className={item} disabled={uploadingWallpaper} onClick={() => { setMoreOpen(false); onWallpaper(); }}>
              <IoImageOutline size={21} className="shrink-0 text-zinc-400" aria-hidden />
              <span>{t(uploadingWallpaper ? "Загрузка..." : "Поставить обои")}</span>
            </button>
            <button type="button" className={item} onClick={() => { setMoreOpen(false); onSecretChat(); }}>
              <IoLockClosedOutline size={21} className="shrink-0 text-zinc-400" aria-hidden />
              <span>{t("Начать секретный чат")}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
