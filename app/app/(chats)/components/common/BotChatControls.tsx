"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useState, type CSSProperties } from "react";
import { CgMenuRound } from "react-icons/cg";
import { AnimatePresence, motion } from "framer-motion";
import { apiRequest } from "@/lib/client/http";
import { DEFAULT_BOT_CHAT_SETTINGS, type BotChatSettings, type BotMenuButton } from "@/lib/bot-chat-settings";
import { toast } from "sonner";

type Snapshot = { profileId: string; settings: BotChatSettings; commands: { command: string; description: string }[] };
export function useBotChatSettings({ enabled, link, chatId, userId }: { enabled: boolean; link: string | null; chatId?: string | null; userId?: string | null }) {
  const key = enabled && link ? `${userId}:${link}:${chatId ?? ""}` : "";
  const [snapshot, setSnapshot] = useState<(Snapshot & { key: string }) | null>(null);
  const [opening, setOpening] = useState<{ key: string; open: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!key || !link) return;
    let live = true, sequence = 0;
    const refresh = () => {
      const current = ++sequence;
      void apiRequest<Snapshot>(`/api/bots/${encodeURIComponent(link)}/ui${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ""}`, { cache: "no-store" }).then(data => {
        if (live && current === sequence) setSnapshot({ ...data, key });
      }).catch(() => {});
    };
    refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = window.setInterval(visible, 10000);
    window.addEventListener("eclipse:bot-ui-updated", refresh);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { live = false; window.clearInterval(interval); window.removeEventListener("eclipse:bot-ui-updated", refresh); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [key, link, chatId]);
  const current = key && snapshot?.key === key ? snapshot : null;
  const settings = current?.settings ?? DEFAULT_BOT_CHAT_SETTINGS;
  const commands = current?.commands ?? [];
  const openingKey = `${key}:${JSON.stringify(settings.menu)}`;
  const menuOpen = opening?.key === openingKey ? opening.open : settings.menu.type === "keyboard" && settings.menu.open_by_default !== false;
  const setMenuOpen = (open: boolean) => setOpening({ key: openingKey, open });
  async function callback(row: number, column: number) {
    if (!link || !chatId || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/bots/${encodeURIComponent(link)}/ui`, { method: "POST", body: JSON.stringify({ chat_id: chatId, row, column, request_id: crypto.randomUUID() }) });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error(error instanceof Error ? error.message : t("Не удалось выполнить действие."));
      window.dispatchEvent(new Event("eclipse:bot-ui-updated"));
    } finally { setBusy(false); }
  }
  return { settings, commands, menuOpen, setMenuOpen, busy, callback };
}
type Controller = ReturnType<typeof useBotChatSettings>;
export function BotMenuToggle({ controller, onMessage }: { controller: Controller; onMessage: (text: string) => void }) {
  const t = useTranslation();
  const { settings, commands, menuOpen, setMenuOpen } = controller;
  const menu = settings.menu;
  if (menu.type === "none" || (menu.type === "commands" && !commands.length)) return null;
  return <div className="relative shrink-0 composer-inline-action self-end mb-1 md:mb-[5px] mr-1">
    <button type="button" aria-label={menu.type === "keyboard" ? menu.button_text ?? t("Меню бота") : t("Команды бота")} aria-expanded={menuOpen} aria-controls={menu.type === "keyboard" ? "custom-bot-menu" : "bot-commands-menu"} onClick={() => setMenuOpen(!menuOpen)} className="flex h-7 w-7 md:h-7.5 md:w-7.5 items-center justify-center rounded-full text-zinc-400 hover:bg-white/8 hover:text-zinc-100 active:scale-95"><CgMenuRound size={18} className="shrink-0" /></button>
    {menu.type === "commands" && menuOpen && <div id="bot-commands-menu" className="absolute bottom-10 right-0 z-50 max-h-64 w-64 overflow-auto rounded-[20px] border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl">
      {commands.map(item => <button type="button" key={item.command} onClick={() => { setMenuOpen(false); onMessage(`/${item.command}`); }} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/8"><span className="text-sm text-zinc-100">/{item.command}</span><span className="block text-xs text-zinc-400">{item.description}</span></button>)}
    </div>}
  </div>;
}
export function BotReplyMenu({ controller, material, onMessage, onUrl }: { controller: Controller; material: CSSProperties; onMessage: (text: string) => void; onUrl: (url: string) => void }) {
  const t = useTranslation();
  const { settings, menuOpen, busy, callback } = controller;
  const menu = settings.menu;
  if (menu.type !== "keyboard") return null;
  function select(button: BotMenuButton, row: number, column: number) {
    if (button.url) onUrl(button.url);
    else if (button.callback_data) void callback(row, column);
    else onMessage(button.message ?? button.text);
  }
  return <AnimatePresence initial={false}>{menuOpen && <motion.div id="custom-bot-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
    <div className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto px-0.5 pb-0.5 pt-2" aria-label={t("Меню бота")}>
      {menu.keyboard.map((row, rowIndex) => <div className="flex gap-2" key={rowIndex}>
        {row.map((button, columnIndex) => <button key={columnIndex} type="button" disabled={busy} onClick={() => select(button, rowIndex, columnIndex)} className="min-h-10 min-w-0 flex-1 break-words rounded-[14px] border border-white/8 px-3 py-2.5 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/10 active:scale-[0.98] disabled:opacity-40 cursor-pointer" style={material}>{button.text}</button>)}
      </div>)}
    </div>
  </motion.div>}</AnimatePresence>;
}
