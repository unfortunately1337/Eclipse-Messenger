"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { apiRequest } from "@/lib/client/http";
import { IMPORTER_BOT_LINK, type ImportCard } from "@/lib/imported-packs";
import { useLanguage, useTranslation } from "./LocaleProvider";
import { plural } from "@/lib/i18n/translate";
import { showAppToast } from "@/lib/client/app-toast";
import { openImportedPack } from "@/lib/client/pack-items";
import { BotInlineActions, BOT_INLINE_ACTION_CLASS_NAME } from "./BotInlineActions";

export default function ImportPackCard({ value, messageId, renderBody = body => body, actionClassName }: { value: ImportCard; messageId: string; renderBody?: (body: ReactNode, options: { showTime: boolean }) => ReactNode; actionClassName?: string }) {
  const t = useTranslation(), { locale } = useLanguage(), reduced = useReducedMotion();
  const sourceKey = `${messageId}:${value.status}:${value.completed}:${value.count}:${value.packCount ?? ""}:${value.update ?? false}:${value.error ?? ""}`;
  const [local, setLocal] = useState<{ key: string; card: ImportCard } | null>(null), [busy, setBusy] = useState(false);
  const card = local?.key === sourceKey ? local.card : value;
  const pending = useRef<{ action: "import" | "cancel"; id: string } | null>(null);
  useEffect(() => {
    if (!["queued", "importing"].includes(card.status)) return;
    let live = true, running = false;
    const poll = () => {
      if (running || document.visibilityState !== "visible") return; running = true;
      void apiRequest<{ card: ImportCard }>(`/api/packs/import-status?messageId=${encodeURIComponent(messageId)}`, { cache: "no-store" })
        .then(data => { if (live) setLocal({ key: sourceKey, card: data.card }); }).catch(() => {}).finally(() => { running = false; });
    };
    const timer = window.setInterval(poll, 1500); poll();
    return () => { live = false; window.clearInterval(timer); };
  }, [card.status, messageId, sourceKey]);
  useEffect(() => { if (card.status === "ready") window.dispatchEvent(new Event("eclipse:packs-updated")); }, [card.status]);
  async function act(action: "import" | "cancel") {
    if (busy) return;
    const request = pending.current?.action === action ? pending.current : { action, id: crypto.randomUUID() };
    pending.current = request; setBusy(true);
    try {
      const response = await apiRequest<{ alreadyInstalled?: boolean }>(`/api/bots/${IMPORTER_BOT_LINK}/callback`, { method: "POST", body: JSON.stringify({ messageId, data: action, requestId: request.id }) });
      pending.current = null; setLocal({ key: sourceKey, card: { ...card, status: action === "cancel" ? "cancelled" : response.alreadyInstalled ? "ready" : "queued", error: undefined } });
    } catch (error) { showAppToast({ type: "error", title: error instanceof Error ? t(error.message) : t("Не удалось начать импорт") }); }
    finally { setBusy(false); }
  }
  const progressing = ["queued", "importing", "ready"].includes(card.status);
  return <div data-import-card className="w-[280px] max-w-full">
    {renderBody(<div className="pb-1">
    <button type="button" onClick={() => openImportedPack({ packId: card.packId })} className="max-w-full break-words text-left text-[15px] font-semibold leading-snug">{card.title}</button>
    <p className="mt-1 text-[15px] font-normal leading-[1.4]">{card.kind === "emoji" && locale === "en" ? `${card.packCount ?? card.count} emoji` : plural(card.packCount ?? card.count, card.kind === "emoji" ? ["эмодзи", "эмодзи", "эмодзи"] : ["стикер", "стикера", "стикеров"], "sticker", locale)}</p>
    {card.update && card.status !== "ready" && <p className="mt-1 text-[15px] font-normal leading-[1.4]">{t("Новых элементов: {0}", { 0: card.count })}</p>}
    <AnimatePresence initial={false}>{progressing && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : .25 }} className="overflow-hidden">
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-[12px] leading-4 opacity-65"><span className="min-w-0 truncate">{card.status !== "ready" && t(card.status === "queued" ? "Подготовка…" : "Импортирование…")}</span><span data-import-counter className="min-w-[7ch] justify-self-end whitespace-nowrap text-right tabular-nums">{card.status === "ready" ? card.count : card.completed}/{card.count}</span></div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={card.count} aria-valuenow={card.completed} aria-label={t("Импортирование…")} className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/10"><motion.div className="h-full origin-left rounded-full bg-[var(--ui-accent-solid,#fff)]" initial={{ scaleX: 0 }} animate={{ scaleX: card.status === "ready" ? 1 : card.completed / Math.max(1, card.count) }} transition={{ duration: reduced ? 0 : .45, ease: [.22, 1, .36, 1] }} /></div>
    </motion.div>}</AnimatePresence>
    {card.status === "failed" && <p className="mt-3 max-w-64 text-[15px] font-normal leading-[1.4] text-red-400">{t(card.error ?? "Импорт прервался. Попробуйте ещё раз.")}</p>}
    {card.status === "cancelled" && <p className="mt-2 text-[15px] font-normal leading-[1.4]">{t("Импорт отменён")}</p>}
    </div>, { showTime: false })}
    {["confirm", "failed"].includes(card.status) && <BotInlineActions>
      <button type="button" disabled={busy} onClick={() => void act("import")} className={actionClassName ?? BOT_INLINE_ACTION_CLASS_NAME}>{t(card.update ? "Доимпортировать" : "Импортировать")}</button>
      <button type="button" disabled={busy} onClick={() => void act("cancel")} className={actionClassName ?? BOT_INLINE_ACTION_CLASS_NAME}>{t("Отмена")}</button>
    </BotInlineActions>}
  </div>;
}
