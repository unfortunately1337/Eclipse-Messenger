"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/client/http";
import { clearImportedEmojiCatalog } from "@/lib/emoji-status";
import { registerPackItems, resolvePackItem } from "@/lib/client/pack-items";
import type { ImportedPack, PackKind } from "@/lib/imported-packs";
import { emptyRecentPackItems, parseRecentPackItems, recordRecentPackItem, type RecentPackItems } from "@/lib/client/recent-pack-items";
import { emptyPackUsage, parsePackUsage, type PackUsage } from "@/lib/client/pack-usage";
import { mergePackSummary } from "@/lib/client/pack-library-cache";
import { PackMedia } from "./PackMedia";
import { useTranslation } from "./LocaleProvider";
import { showAppToast } from "@/lib/client/app-toast";
import { useVirtualViewport } from "@/lib/client/use-virtual-viewport";

type Library = { packs: ImportedPack[]; refresh: () => Promise<void>; load: (id: string) => Promise<ImportedPack>; toggle: (pack: ImportedPack) => Promise<void>; recent: RecentPackItems; usage: PackUsage; rememberUsed: (kind: PackKind, id: string, packId: string) => void };
const Context = createContext<Library | null>(null);
export const usePackLibrary = () => useContext(Context);
export default function PackLibraryProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const t = useTranslation(), reduced = useReducedMotion();
  const [packs, setPacks] = useState<ImportedPack[]>([]), [modal, setModal] = useState<ImportedPack | null>(null), [busy, setBusy] = useState(false);
  const cache = useRef(new Map<string, ImportedPack>()), sequence = useRef(0);
  const inFlight = useRef(new Map<string, Promise<ImportedPack>>());
  const refreshFlight = useRef<{ owner: string; request: Promise<void> } | null>(null);
  const owner = useRef(userId);
  const recentKey = `eclipse:pack-recents:v1:${userId}`;
  const usageKey = `eclipse:pack-usage:v1:${userId}`;
  const [usageState, setUsageState] = useState({ key: usageKey, value: emptyPackUsage() });
  const usage = usageState.key === usageKey ? usageState.value : emptyPackUsage();
  const [recentState, setRecentState] = useState({ key: recentKey, value: emptyRecentPackItems() });
  const recent = recentState.key === recentKey ? recentState.value : emptyRecentPackItems();
  useEffect(() => {
    const sync = () => { try { setRecentState({ key: recentKey, value: parseRecentPackItems(localStorage.getItem(recentKey)) }); setUsageState({ key: usageKey, value: parsePackUsage(localStorage.getItem(usageKey)) }); } catch { /* Storage may be disabled. */ } };
    sync();
    const storage = (event: StorageEvent) => { if (event.key === recentKey || event.key === usageKey || event.key === null) sync(); };
    window.addEventListener("storage", storage); return () => window.removeEventListener("storage", storage);
  }, [recentKey, usageKey]);
  const rememberUsed = useCallback((kind: PackKind, id: string, packId: string) => {
    setRecentState(previous => {
      const value = recordRecentPackItem(previous.key === recentKey ? previous.value : emptyRecentPackItems(), kind, id);
      try { localStorage.setItem(recentKey, JSON.stringify(value)); } catch { /* Keep in-memory history when storage is unavailable. */ }
      return { key: recentKey, value };
    });
    setUsageState(previous => {
      const current = previous.key === usageKey ? previous.value : emptyPackUsage();
      const value = parsePackUsage(JSON.stringify({ ...current, [kind]: { ...current[kind], [packId]: Math.min(Number.MAX_SAFE_INTEGER, (current[kind][packId] ?? 0) + 1) } }));
      try { localStorage.setItem(usageKey, JSON.stringify(value)); } catch { /* In-memory ordering still works. */ }
      return { key: usageKey, value };
    });
  }, [recentKey, usageKey]);
  const remember = useCallback((pack: ImportedPack) => {
    registerPackItems(pack.items.map(item => ({ ...item, title: pack.title, kind: pack.kind })));
    cache.current.set(pack.id, pack);
  }, []);
  const refresh = useCallback(() => {
    if (refreshFlight.current?.owner === userId) return refreshFlight.current.request;
    const request = apiRequest<{ packs: ImportedPack[] }>("/api/packs", { cache: "no-store" }).then(data => {
      if (owner.current !== userId) return;
      const next = data.packs.map(pack => {
        const cached = cache.current.get(pack.id), full = mergePackSummary(pack, cached);
        if (full !== cached) remember(full);
        return full;
      });
      setPacks(previous => previous.length === next.length && previous.every((pack, index) => pack === next[index]) ? previous : next);
    }).finally(() => { if (refreshFlight.current?.request === request) refreshFlight.current = null; });
    refreshFlight.current = { owner: userId, request }; return request;
  }, [remember, userId]);
  const load = useCallback(async (id: string) => {
    const cached = cache.current.get(id);
    if (cached?.ready && cached.items.length === cached.count) return cached;
    const pending = inFlight.current.get(id); if (pending) return pending;
    const request = apiRequest<{ pack: ImportedPack }>(`/api/packs/${id}`, { cache: "no-store" }).then(({ pack }) => {
      if (owner.current !== userId) throw new DOMException("", "AbortError");
      remember(pack); setPacks(previous => previous.map(value => value.id === id ? pack : value)); return pack;
    }).finally(() => { if (inFlight.current.get(id) === request) inFlight.current.delete(id); });
    inFlight.current.set(id, request); return request;
  }, [remember, userId]);
  const toggle = useCallback(async (pack: ImportedPack) => {
    await apiRequest(`/api/packs/${pack.id}`, { method: "POST", body: JSON.stringify({ action: pack.installed ? "remove" : "add" }) });
    const changed = { ...pack, installed: !pack.installed }; remember(changed);
    setModal(current => current?.id === changed.id ? changed : current);
    await refresh();
  }, [refresh, remember]);
  useEffect(() => {
    if (!modal) return;
    const current = packs.find(pack => pack.id === modal.id);
    if (!current || current.revision === modal.revision) return;
    let live = true;
    void load(current.id).then(pack => { if (live) setModal(previous => previous?.id === pack.id ? pack : previous); }).catch(() => {});
    return () => { live = false; };
  }, [packs, modal, load]);
  useEffect(() => {
    owner.current = userId;
    cache.current.clear(); inFlight.current.clear(); clearImportedEmojiCatalog();
    void refresh().catch(() => {});
    const update = (event: Event) => {
      if (document.visibilityState !== "visible") return;
      // An import may finish after a running request has taken its snapshot.
      // Revalidate once after it; simple focus bursts still share that request.
      if (event.type === "eclipse:packs-updated" && refreshFlight.current?.owner === userId) {
        void refreshFlight.current.request.catch(() => {}).then(refresh).catch(() => {});
      } else void refresh().catch(() => {});
    };
    window.addEventListener("eclipse:packs-updated", update); window.addEventListener("focus", update);
    return () => { window.removeEventListener("eclipse:packs-updated", update); window.removeEventListener("focus", update); sequence.current++; };
  }, [userId, refresh]);
  useEffect(() => {
    const open = (event: Event) => {
      const { packId, itemId } = (event as CustomEvent<{ packId?: string; itemId?: string }>).detail ?? {};
      const current = ++sequence.current;
      void (async () => {
        const id = packId ?? (itemId ? (await resolvePackItem(itemId))?.packId : null);
        if (!id || !/^pack-[a-f0-9]{24}$/.test(id)) return;
        const pack = await load(id);
        if (current === sequence.current) setModal(pack);
      })().catch(() => showAppToast({ type: "error", title: t("Не удалось открыть набор") }));
    };
    window.addEventListener("eclipse:open-pack", open); return () => window.removeEventListener("eclipse:open-pack", open);
  }, [load, t]);
  const library = useMemo(() => ({ packs, refresh, load, toggle, recent, usage, rememberUsed }), [packs, refresh, load, toggle, recent, usage, rememberUsed]);
  return <Context.Provider value={library}>{children}
    <Dialog.Root open={Boolean(modal)} onOpenChange={open => { if (!open) { sequence.current++; setModal(null); } }}>
      <AnimatePresence>{modal && <Dialog.Portal forceMount>
        <Dialog.Overlay asChild><motion.div className="fixed inset-0 z-[200] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} /></Dialog.Overlay>
        <Dialog.Content asChild forceMount aria-describedby={undefined}><motion.div data-pack-dialog className="app-panel-surface fixed left-1/2 top-1/2 z-[201] flex max-h-[min(640px,85dvh)] w-[min(440px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-[#1c1c1e] text-zinc-100 shadow-2xl outline-none" initial={{ opacity: 0, scale: .92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95, y: 8 }} transition={{ duration: reduced ? 0 : .24, ease: [.22, 1, .36, 1] }}>
          <div className="flex shrink-0 items-center gap-3 px-5 py-4"><Dialog.Title className="min-w-0 flex-1 truncate text-[17px] font-semibold">{modal.title}</Dialog.Title><Dialog.Close aria-label={t("Закрыть")} className="grid size-8 shrink-0 place-items-center border-0 bg-transparent shadow-none outline-none ring-0 transition-opacity hover:opacity-70 focus-visible:opacity-70"><X size={20} /></Dialog.Close></div>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"><PackGrid pack={modal} /></div>
          <div className="shrink-0 px-4 pb-4 pt-2"><button type="button" disabled={busy || !modal.ready} onClick={() => { setBusy(true); void toggle(modal).catch(error => showAppToast({ type: "error", title: error instanceof Error ? t(error.message) : t("Не удалось изменить набор") })).finally(() => setBusy(false)); }} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-0 px-4 py-3 text-sm font-semibold shadow-none transition-opacity disabled:opacity-40 ${modal.installed ? "bg-transparent text-red-400" : "bg-[var(--ui-accent-solid,#fff)] text-[color:var(--ui-accent-contrast,#111)]"}`}>{modal.installed ? t("Удалить") : <><span>{t("Добавить")}</span><span className="inline-flex min-w-5 items-center justify-center rounded-[7px] bg-current/15 px-1.5 py-0.5 text-[12px] leading-4 tabular-nums">{modal.count}</span></>}</button></div>
        </motion.div></Dialog.Content>
      </Dialog.Portal>}</AnimatePresence>
    </Dialog.Root>
  </Context.Provider>;
}
function PackGrid({ pack }: { pack: ImportedPack }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLElement | null>(null);
  useEffect(() => { viewport.current = ref.current?.parentElement ?? null; }, []);
  const view = useVirtualViewport(viewport, { top: 0, height: 400, width: 400 });
  const columns = pack.kind === "emoji" ? 7 : 4, row = Math.floor(view.width / columns);
  const first = Math.max(0, Math.floor(view.top / row) - 1) * columns, last = Math.ceil((view.top + view.height) / row + 1) * columns;
  return <div ref={ref} className="relative" style={{ height: Math.ceil(pack.items.length / columns) * row }}>
    {pack.items.slice(first, last).map((item, offset) => { const index = first + offset; return <div key={item.id} className="absolute grid place-items-center p-2" style={{ top: Math.floor(index / columns) * row, left: `${index % columns * 100 / columns}%`, width: `${100 / columns}%`, height: row }}><PackMedia item={item} /></div>; })}
  </div>;
}
