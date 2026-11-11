"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { useTranslation } from "./LocaleProvider";
import { BotInlineActions } from "./BotInlineActions";

type Status = { linked: boolean; username: string };
export default function TelegramImportConnect({ renderBody, actionClassName }: { renderBody: (body: ReactNode) => ReactNode; actionClassName: string }) {
  const t = useTranslation(), [status, setStatus] = useState<Status | null>(null), [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false), ref = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    const next = await apiRequest<Status>("/api/packs/telegram", { cache: "no-store" });
    setStatus(previous => previous?.linked === next.linked && previous.username === next.username ? previous : next);
    setFailure(false);
  }, []);
  useEffect(() => {
    let live = true, running = false;
    const update = () => {
      if (!live || running || document.visibilityState !== "visible") return;
      const rect = ref.current?.getBoundingClientRect();
      if (rect && (rect.bottom < 0 || rect.top > innerHeight)) return;
      running = true;
      void refresh().catch(() => { if (live) setFailure(true); }).finally(() => { running = false; });
    };
    update(); const timer = window.setInterval(update, 5000);
    window.addEventListener("focus", update);
    return () => { live = false; window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [refresh]);
  async function connect() {
    if (busy) return; setBusy(true);
    // Open in the click gesture so mobile browsers do not block the Telegram link.
    const popup = window.open("about:blank", "_blank"); if (popup) popup.opener = null;
    try {
      const { url } = await apiRequest<{ url: string }>("/api/packs/telegram", { method: "POST" });
      if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=import_[A-Za-z0-9_-]{32}$/.test(url)) throw new Error(t("Не удалось открыть Telegram"));
      if (popup) popup.location.replace(url); else window.location.assign(url);
    } catch (error) { popup?.close(); showAppToast({ type: "error", title: error instanceof Error ? t(error.message) : t("Не удалось открыть Telegram") }); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (busy) return; setBusy(true);
    try { await apiRequest("/api/packs/telegram", { method: "DELETE" }); await refresh(); }
    catch { showAppToast({ type: "error", title: t("Не удалось отключить Telegram") }); }
    finally { setBusy(false); }
  }
  return <div ref={ref} data-telegram-import-connect className="w-[280px] max-w-full">
    {renderBody(<div className="pb-4">
    <div className="text-[15px] font-semibold">{t("Импорт через Telegram")}</div>
    <motion.div initial={false} animate={{ opacity: 1 }} transition={{ duration: .15 }}>
      <p className="mt-2 text-[15px] font-normal leading-[1.4]">{t(status?.linked ? "Telegram подключён. Отправьте боту стикер или сообщение с кастомным эмодзи. Карточка набора появится здесь." : "Подключите Telegram и отправьте боту стикер или кастомный эмодзи. Ссылку на набор копировать не нужно.")}</p>
      {failure && <p className="mt-2 text-[15px] font-normal leading-[1.4]">{t("Не удалось проверить подключение. Попробуйте ещё раз.")}</p>}
    </motion.div>
    </div>)}
    <BotInlineActions>
      {status?.linked ? <>
        <a href={`https://t.me/${status.username}`} target="_blank" rel="noopener noreferrer" className={actionClassName}>{t("Открыть Telegram")}</a>
        <button type="button" disabled={busy} onClick={() => void disconnect()} className={actionClassName}>{t("Отключить Telegram")}</button>
      </> : <button type="button" disabled={busy} onClick={() => void connect()} className={actionClassName}>{t(busy ? "Подготовка…" : "Подключить Telegram")}</button>}
    </BotInlineActions>
  </div>;
}
