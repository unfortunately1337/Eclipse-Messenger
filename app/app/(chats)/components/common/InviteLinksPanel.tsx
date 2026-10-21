"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation, useLanguage } from "@/components/LocaleProvider";

import { invitationUrl } from "@/lib/client/deployment-url";
import { PanelNavigation } from "./PanelNavigation";
import { panelOverlayMotion, PANEL_SUBVIEW_VARIANTS } from "@/lib/client/panel-motion";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LottieSticker } from "./LottieSticker";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, MoreVertical, Plus, Share2 } from "lucide-react";
import { FaLink } from "react-icons/fa";
import { apiRequest } from "@/lib/client/http";

type Invite = { token: string; isPrimary: boolean; name: string | null; expiresAt: string | null; usageLimit: number | null; usageCount: number; revokedAt: string | null };
type Data = { token: string | null; links: Invite[] };
const field = "w-full rounded-[18px] border border-white/[0.08] bg-transparent px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-zinc-500 focus:border-[var(--ui-accent-solid,#38bdf8)] transition-colors";
const button = "flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-white/[0.06] px-4 text-[14px] font-semibold transition-colors hover:bg-white/10 disabled:opacity-40";

function InviteAnimation() {
  const t = useTranslation();
  return <div data-invite-animation><LottieSticker src="/stickers/UtyanLinks.json" className="h-28 w-28" /></div>;
}

export function InviteLinksPanel({ kind, link, desktop, onClose, notify, panelThemeStyle }: {
  panelThemeStyle?: CSSProperties;
  kind: "group" | "channel"; link: string; desktop: boolean; onClose: () => void; notify: (message: string) => void;
}) {
  const t = useTranslation();
  const { locale: language } = useLanguage();
  const [data, setData] = useState<Data | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null), [view, setViewState] = useState<"list" | "create" | "revoke">("list");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  function setView(next: "list" | "create" | "revoke") { setDirection(next === "list" ? "backward" : "forward"); setViewState(next); }
  const [menu, setMenu] = useState<string | null>(null), [target, setTarget] = useState<Invite | null>(null);
  const [name, setName] = useState(""), [expires, setExpires] = useState(""), [limit, setLimit] = useState("");
  const [now, setNow] = useState(0);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => setHost(desktop ? document.querySelector("[data-community-details]") : null)); return () => cancelAnimationFrame(frame); }, [desktop]);
  const dialogRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion(), endpoint = `/api/invites/${kind}/${encodeURIComponent(link)}`;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => { window.clearInterval(timer); previous?.focus(); };
  }, [host]);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        let result = await apiRequest<Data>(endpoint, { method: "GET" });
        if (!result.token) result = await apiRequest<Data>(endpoint, { method: "POST", body: JSON.stringify({}) });
        if (live) setData(result);
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : (language === "en" ? "Failed to load invites" : t("Не удалось загрузить приглашения"))); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [endpoint, language, t]);
  const url = invitationUrl;
  async function share(token: string, copy = false) {
    try {
      if (!copy && navigator.share) await navigator.share({ url: url(token) });
      else { await navigator.clipboard.writeText(url(token)); notify(t("Ссылка скопирована")); }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) notify(t("Не удалось скопировать ссылку")); }
    setMenu(null);
  }
  async function mutate(remove = false) {
    if (saving) return;
    if (!remove && limit && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100000)) { setError(language === "en" ? "Usage limit must be between 1 and 100000" : t("Лимит вступлений — от 1 до 100000")); return; }
    setSaving(true); setError(null);
    try {
      const result = await apiRequest<Data>(endpoint, { method: remove ? "DELETE" : "POST", body: JSON.stringify(remove ? { token: target?.token, regenerate: target?.isPrimary } : { additional: true, name, expiresIn: expires ? Number(expires) : null, usageLimit: limit ? Number(limit) : null }) });
      setData(result); setView("list"); setTarget(null); setMenu(null);
      notify(remove ? t("Ссылка удалена") : t("Ссылка создана"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : (language === "en" ? "Failed to save invite" : t("Не удалось сохранить приглашение"))); }
    finally { setSaving(false); }
  }
  const primary = data?.links.find(item => item.isPrimary && !item.revokedAt);
  const others = data?.links.filter(item => !item.isPrimary && !item.revokedAt) ?? [];
  function status(item: Invite) {
    if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return t("Срок действия истёк");
    if (item.usageLimit !== null && item.usageCount >= item.usageLimit) return t("Лимит вступлений исчерпан");
    const locale = language === "en" ? "en-US" : "ru-RU";
    const formattedDate = item.expiresAt ? new Date(item.expiresAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const joinsWord = language === "en" ? (item.usageCount === 1 ? "join" : "joins") : t("вступлений");
    const ofWord = language === "en" ? "of" : t("из");
    const untilWord = language === "en" ? "Expires" : t("До");
    const noExpiryWord = language === "en" ? "No expiration" : t("Без срока действия");
    return `${item.usageCount} ${joinsWord}${item.usageLimit ? ` ${ofWord} ${item.usageLimit}` : ""}${item.expiresAt ? ` · ${untilWord} ${formattedDate}` : ` · ${noExpiryWord}`}`;
  }
  function row(item: Invite) {
    return <div key={item.token} className="relative rounded-[24px] bg-white/[0.04] p-3">
      {item.name && <p className="px-1 pb-2 text-[14px] font-medium">{t(item.name ?? "")}</p>}
      <div className="flex items-center gap-2 rounded-[18px] border border-white/[0.08] pl-4 pr-1">
        <button onClick={() => void share(item.token, true)} className="min-w-0 flex-1 truncate py-3.5 text-left text-[14px]" aria-label={t("Копировать")}>{url(item.token)}</button>
        <button aria-label={t("Действия со ссылкой")} aria-expanded={menu === item.token} onClick={() => setMenu(menu === item.token ? null : item.token)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/5"><MoreVertical size={19} /></button>
      </div>
      <AnimatePresence initial={false}>{menu === item.token && <motion.div key="link-actions" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden"><div className="grid grid-cols-2 gap-2 pt-2"><button className={button} onClick={() => void share(item.token, true)}>{t("Копировать")}</button><button className={`${button} text-red-300`} onClick={() => { setMenu(null); setTarget(item); setView("revoke"); setError(null); }}>{t("Удалить")}</button></div></motion.div>}</AnimatePresence>
      <p className="px-1 py-2 text-[12px] leading-5 text-zinc-400">{status(item)}</p>
      {item.isPrimary && <button className={`${button} w-full`} onClick={() => void share(item.token)}><Share2 size={17} />{t("Поделиться")}</button>}
    </div>;
  }
  const content = <>
    {!desktop && <motion.button aria-label={t("Закрыть приглашения")} className="fixed inset-0 z-[120] bg-black/50" onClick={() => !saving && onClose()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }} />}
    <motion.section style={desktop ? undefined : panelThemeStyle} data-community-overlay data-app-panel={!desktop || undefined} ref={dialogRef} role="dialog" aria-modal={!desktop} aria-label={t("Ссылки приглашения")} className={`${desktop ? "absolute bg-transparent" : "fixed bg-[#171719]"} inset-0 z-[121] flex flex-col overflow-hidden text-zinc-100`} {...panelOverlayMotion(reduced)} onKeyDown={event => { if (!desktop && event.key === "Tab") { const buttons = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]'); if (buttons?.length) { const first = buttons[0], last = buttons[buttons.length-1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } } if (event.key === "Escape" && !saving) { if (view !== "list") setView("list"); else onClose(); } }}>
      <header className="flex h-14 shrink-0 items-center gap-3 px-4"><button aria-label={t("Назад")} disabled={saving} onClick={() => { setError(null); if (view === "list") onClose(); else setView("list"); }} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/5"><ArrowLeft size={23} /></button><h2 className="min-w-0 flex-1 text-[20px] font-semibold">{view === "create" ? t("Новая ссылка") : view === "revoke" ? t("Удалить ссылку?") : t("Ссылки приглашения")}</h2>{view === "create" && <button aria-label={t("Создать ссылку")} disabled={saving} onClick={() => void mutate()} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/5 disabled:opacity-40"><Check size={23} /></button>}</header>
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-[max(env(safe-area-inset-bottom),24px)]">
        {error && <p role="alert" className="mb-3 rounded-[18px] bg-red-500/10 px-4 py-3 text-[13px] text-red-300">{t(error ?? "")}</p>}
        <PanelNavigation direction={direction}><motion.div key={view} custom={direction} variants={PANEL_SUBVIEW_VARIANTS} initial="initial" animate="animate" exit="exit" className="space-y-4">
          {view === "list" ? <>
            <div className="rounded-[24px] bg-white/[0.04] px-5 pb-5 pt-4"><div className="flex justify-center py-3"><InviteAnimation /></div><p className="mt-3 text-[13px] leading-5 text-zinc-400">{kind === "group" ? t("По ссылке люди смогут вступить в вашу группу. Вы можете ограничить срок действия и число вступлений.") : t("По ссылке люди смогут подписаться на ваш канал. Вы можете ограничить срок действия и число вступлений.")}</p></div>
            {loading ? <p className="py-4 text-center text-sm text-zinc-400">{t("Загрузка…")}</p> : <><p className="px-3 text-[13px] font-medium text-zinc-400">{t("Основная ссылка")}</p>{primary ? row(primary) : <button className={`${button} w-full`} onClick={() => { setTarget({ isPrimary: true } as Invite); void apiRequest<Data>(endpoint, { method: "POST", body: "{}" }).then(setData).catch(cause => setError(cause.message)); }}>{t("Создать основную ссылку")}</button>}<div className="space-y-3"><button className={`${button} w-full text-[color:var(--ui-accent-solid,#fff)]`} onClick={() => { setName(""); setExpires(""); setLimit(""); setError(null); setView("create"); }}><Plus size={20} />{t("Создать новую ссылку")}</button>{others.length ? others.map(row) : <p className="py-3 text-center text-[13px] text-zinc-500">{t("Дополнительных ссылок пока нет")}</p>}</div></>}
          </> : view === "create" ? <>
            <div className="space-y-3 rounded-[24px] bg-white/[0.04] p-4"><input aria-label={t("Название ссылки")} placeholder={t("Название ссылки (необязательно)")} value={name} onChange={event => setName(event.target.value)} maxLength={64} className={field} /><p className="px-1 text-[12px] text-zinc-400">{t("Название видно только администраторам.")}</p></div>
            <div className="space-y-3 rounded-[24px] bg-white/[0.04] p-4"><label className="block text-[13px] text-zinc-400" htmlFor="invite-expiry">{t("Срок действия")}</label><div className="relative"><select id="invite-expiry" className={`${field} appearance-none pr-12 cursor-pointer`} value={expires} onChange={event => setExpires(event.target.value)}><option className="bg-zinc-900" value="">{t("Без ограничений")}</option>{[[3600, t("1 час")],[86400, t("1 день")],[604800, t("7 дней")],[2592000, t("30 дней")]].map(([value,label]) => <option className="bg-zinc-900" key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" /></div><label className="block text-[13px] text-zinc-400" htmlFor="invite-limit">{t("Лимит вступлений")}</label><input id="invite-limit" placeholder={t("Без ограничений")} inputMode="numeric" value={limit} onChange={event => setLimit(event.target.value)} className={field} /><p className="text-[12px] leading-5 text-zinc-400">{t("После окончания срока или достижения лимита ссылка перестанет работать.")}</p></div>
          </> : <div className="space-y-4 rounded-[24px] bg-white/[0.04] p-5"><FaLink size={28} /><p className="text-[14px] leading-6 text-zinc-300">{kind === "group" ? t("Никто больше не сможет вступить по этой ссылке. Участники останутся в группе.") : t("Никто больше не сможет вступить по этой ссылке. Участники останутся в канале.")}{target?.isPrimary && t(" Вместо основной ссылки будет создана новая.")}</p><button disabled={saving} className={`${button} w-full text-red-300`} onClick={() => void mutate(true)}>{t("Удалить ссылку")}</button></div>}
        </motion.div></PanelNavigation>
      </div>
    </motion.section>
  </>;
  return desktop ? (host ? createPortal(content, host) : null) : content;
}
