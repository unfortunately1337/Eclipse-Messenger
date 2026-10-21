"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { apiRequest } from "@/lib/client/http";
import type { BotManagementAction, BotManagementResult, BotManagementState } from "@/lib/bot-management";
import type { EclipseSystemMessage } from "@/lib/eclipse-system";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function useEclipseBotManagement({ enabled, ownerId, onMessages }: {
  enabled: boolean; ownerId: string | null; onMessages: (messages: EclipseSystemMessage[]) => void;
}) {
  const [state, setState] = useState<BotManagementState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(false);
  const generation = useRef(0);
  const inflight = useRef(false);
  const retry = useRef<{ key: string; requestId: string; revision: number } | null>(null);
  const stateRef = useRef(state);
  const onMessagesRef = useRef(onMessages);
  stateRef.current = state; onMessagesRef.current = onMessages;
  async function refresh() {
    const requestGeneration = generation.current;
    const next = await apiRequest<BotManagementState>("/api/eclipse/bots", { cache: "no-store" });
    if (alive.current && generation.current === requestGeneration && next.revision >= (stateRef.current?.revision ?? 0)) { stateRef.current = next; setState(next); }
    return next;
  }
  useEffect(() => {
    generation.current++; alive.current = enabled && Boolean(ownerId);
    setState(null); stateRef.current = null; setMenuOpen(false); setBusy(false); setError(null); retry.current = null; inflight.current = false;
    if (!alive.current) return;
    const requestGeneration = generation.current;
    void refresh().catch(() => { if (alive.current && requestGeneration === generation.current) setError(t("Не удалось подключиться к боту.")); });
    const updated = () => { void refresh().catch(() => {}); };
    window.addEventListener("eclipse:bot-management-updated", updated); window.addEventListener("focus", updated);
    return () => { alive.current = false; generation.current++; window.removeEventListener("eclipse:bot-management-updated", updated); window.removeEventListener("focus", updated); };
  }, [enabled, ownerId, t]);

  const act = useCallback(async (action: BotManagementAction, options: { text?: string; botId?: string; file?: File } = {}) => {
    if (!alive.current || inflight.current) return false;
    const requestGeneration = generation.current;
    inflight.current = true; setBusy(true); setError(null);
    try {
      const current = stateRef.current ?? await refresh();
      if (!alive.current || requestGeneration !== generation.current) return false;
      const key = JSON.stringify({ action, text: options.text, botId: options.botId });
      const request = retry.current?.key === key && !options.file ? retry.current : { key, requestId: crypto.randomUUID(), revision: current.revision };
      retry.current = options.file ? null : request;
      let body: BodyInit;
      if (options.file) {
        const form = new FormData(); form.set("file", options.file); form.set("revision", String(current.revision)); form.set("requestId", request.requestId); body = form;
      } else body = JSON.stringify({ action, botId: options.botId, text: options.text, requestId: request.requestId, revision: request.revision });
      const result = await apiRequest<BotManagementResult>("/api/eclipse/bots", { method: "POST", body });
      if (!alive.current || requestGeneration !== generation.current) return false;
      stateRef.current = result.state; setState(result.state); retry.current = null;
      if (result.messages.some(message => message.systemPayload?.botRole === "assistant")) setMenuOpen(true);
      onMessagesRef.current(result.messages);
      return true;
    } catch (error) {
      if (!alive.current || requestGeneration !== generation.current) return false;
      if (error instanceof Error && error.name === "AbortError") return false;
      toast.error(error instanceof Error ? error.message : t("Не удалось выполнить действие."));
      const previousRevision = stateRef.current?.revision;
      try { const next = await refresh(); if (next.revision !== previousRevision) retry.current = null; } catch { /* Keep the error visible. */ }
      return false;
    } finally {
      if (requestGeneration === generation.current) { inflight.current = false; if (alive.current) setBusy(false); }
    }
  }, [t]);
  return { state, menuOpen, setMenuOpen, busy, error, act, refresh };
}

export function EclipseBotMenu({ controller, material }: { controller: ReturnType<typeof useEclipseBotManagement>; material: CSSProperties }) {
  const t = useTranslation();
  const { state, busy, menuOpen, act } = controller;
  const step = state?.step ?? "root";
  const button = (label: string, action: BotManagementAction, botId?: string, extraClass = "") => (
    <button key={`${action}:${botId ?? ""}`} type="button" disabled={busy || !state} onClick={() => void act(action, { botId })}
      className={cn("min-h-10 rounded-[14px] border border-white/8 px-3 py-2.5 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/10 active:scale-[0.98] disabled:opacity-40 cursor-pointer", extraClass)} style={material}>{label}</button>
  );
  return <>
    <AnimatePresence initial={false}>{menuOpen && <motion.div id="eclipse-bot-menu" key="menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="grid grid-cols-2 gap-2 px-0.5 pb-0.5 pt-2" aria-label={t("Меню системного бота")}>
        {step === "root" && button(t("Боты"), "bots", undefined, "col-span-2")}
        {step === "bots" && <>{button(t("Создать бота"), "create")}{button(t("Мои боты"), "mine")}</>}
        {step === "mine" && (state?.bots.length ? state.bots.map(bot => button(`${bot.name} (@${bot.username})`, "select", bot.id, "col-span-2 break-words")) : <p className="col-span-2 py-2 text-center text-sm text-zinc-400">{t("У вас пока нет ботов")}</p>)}
        {step === "detail" && <>{button(t("API Токен"), "api_token")}{button(t("Настройки бота"), "settings")}{button(t("Удалить бота"), "delete", undefined, "col-span-2")}</>}
        {step === "settings" && <>{button(t("Изменить имя"), "change_name")}{button(t("Изменить уникальное имя"), "change_username")}{button(t("Сменить аватар"), "change_avatar")}{button(t("Разрешение для групп"), "group_permissions")}</>}
        {step === "api_token" && button(t("Отозвать токен"), "revoke", undefined, "col-span-2")}
        {step === "delete_confirm" && button(t("Подтвердить"), "confirm_delete", undefined, "col-span-2")}
        {step === "avatar" && button(t("Пропустить"), "skip", undefined, "col-span-2")}
        {step !== "root" && button(step === "delete_confirm" ? t("Отмена") : t("Назад"), "back", undefined, "col-span-2")}
      </div>
    </motion.div>}</AnimatePresence>
  </>;
}
