"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePackLibrary } from "./PackLibraryProvider";
import { PackMedia } from "./PackMedia";
import { InlineEmoji } from "./InlineEmoji";
import { useTranslation } from "./LocaleProvider";
import { DEFAULT_ANIMATED_EMOJIS } from "@/lib/client/default-animated-emojis";
import { IMPORTER_BOT_LINK, importedEmojiToken, type PackItem, type PackKind } from "@/lib/imported-packs";
import { useReducedMotion } from "framer-motion";
import { resolvePackItem } from "@/lib/client/pack-items";

type PickerItem = PackItem | { id: string; emoji: string; native: true };

export default function AccountPackPicker({ kind, includeDefault = false, onEmoji, onSticker, selectedId, mobile = false, showRecent = false }: {
  kind: PackKind; includeDefault?: boolean; onEmoji?: (value: string, id?: string) => void;
  onSticker?: (item: PackItem) => void; selectedId?: string | null; mobile?: boolean; showRecent?: boolean;
}) {
  const t = useTranslation(), library = usePackLibrary(), reduced = useReducedMotion();
  const packs = library?.packs.filter(pack => pack.kind === kind) ?? [];
  const previews = [...(includeDefault ? [{ id: "default", title: "Default", item: null }] : []), ...packs.map(pack => ({ id: pack.id, title: pack.title, item: pack.items[0] }))];
  if (showRecent) previews.sort((a, b) => (library?.usage[kind][b.id] ?? 0) - (library?.usage[kind][a.id] ?? 0));
  const [selection, setSelection] = useState(includeDefault ? "default" : ""), [search, setSearch] = useState("");
  const activeId = selection === "default" && includeDefault ? "default" : packs.some(pack => pack.id === selection) ? selection : includeDefault ? "default" : packs[0]?.id ?? "";
  const active = packs.find(pack => pack.id === activeId);
  const loading = Boolean(active && active.items.length < active.count);
  const load = library?.load;
  const viewport = useRef<HTMLDivElement>(null), frame = useRef<number | null>(null);
  const packStrip = useRef<HTMLDivElement>(null), drag = useRef<{ id: number; x: number; left: number; moved: boolean } | null>(null), dragged = useRef(false);
  const [view, setView] = useState({ top: 0, height: 240, width: 350 });
  const navigateToPack = useRef(false);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const recentIds = library?.recent[kind];
  const [resolvedRecent, setResolvedRecent] = useState<PackItem[]>([]);
  useEffect(() => {
    if (!showRecent || !recentIds?.length) return;
    let live = true;
    void Promise.all(recentIds.filter(id => id.startsWith("tg-")).map(resolvePackItem)).then(values => {
      if (live) setResolvedRecent(values.filter((item): item is NonNullable<typeof item> => Boolean(item) && item?.kind === kind));
    });
    return () => { live = false; };
  }, [showRecent, recentIds, kind]);
  useEffect(() => {
    if (active && active.items.length < active.count && load) void load(active.id).catch(() => {});
  }, [active, load]);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const measure = () => setView({ top: element.scrollTop, height: element.clientHeight, width: element.clientWidth });
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => { observer.disconnect(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);
  useEffect(() => {
    const strip = packStrip.current; if (!strip) return;
    const wheel = (event: WheelEvent) => {
      if (strip.scrollWidth <= strip.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault(); event.stopPropagation();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1);
      strip.scrollBy({ left: delta, behavior: reduced ? "instant" : "smooth" });
    };
    strip.addEventListener("wheel", wheel, { passive: false });
    return () => strip.removeEventListener("wheel", wheel);
  }, [includeDefault, packs.length, reduced]);
  const resetScroll = () => { if (viewport.current) viewport.current.scrollTop = 0; setView(previous => ({ ...previous, top: 0 })); };
  const items: PickerItem[] = activeId === "default"
    ? DEFAULT_ANIMATED_EMOJIS.filter(emoji => !search || emoji.includes(search)).map(emoji => ({ id: emoji, emoji, native: true as const }))
    : (active?.items ?? []).filter(item => !search || item.emoji.includes(search) || active?.title.toLowerCase().includes(search.toLowerCase()));
  const columns = kind === "emoji" ? Math.max(5, Math.min(7, Math.floor(view.width / 42))) : 4;
  const rowHeight = kind === "emoji" ? mobile ? 46 : 44 : Math.floor(view.width / columns);
  const recentItems: PickerItem[] = !showRecent || search ? [] : (recentIds ?? []).flatMap<PickerItem>(id => {
    if (kind === "emoji" && !id.startsWith("tg-") && DEFAULT_ANIMATED_EMOJIS.includes(id)) return [{ id, emoji: id, native: true }];
    const item = resolvedRecent.find(value => value.id === id);
    return item && packs.some(pack => pack.id === item.packId) ? [item] : [];
  });
  const rows: { top: number; height: number; title?: string; items?: PickerItem[]; recent?: boolean }[] = [];
  let height = 0;
  const section = (title: string, values: PickerItem[], recent = false) => {
    rows.push({ top: height, height: 25, title, recent }); height += 25;
    for (let index = 0; index < values.length; index += columns) {
      rows.push({ top: height, height: rowHeight, items: values.slice(index, index + columns), recent }); height += rowHeight;
    }
  };
  if (recentItems.length) section(t("Недавние"), recentItems, true);
  const packOffset = height;
  section(activeId === "default" ? "Default" : active?.title ?? t("Мои наборы"), items);
  useEffect(() => {
    if (!navigateToPack.current) return;
    const animation = requestAnimationFrame(() => {
      if (!navigateToPack.current) return;
      viewport.current?.scrollTo({ top: packOffset, behavior: reduced ? "instant" : "smooth" });
    });
    return () => cancelAnimationFrame(animation);
  }, [activeId, packOffset, navigationVersion, loading, reduced]);
  const choose = (item: PickerItem) => {
    if (showRecent) library?.rememberUsed(kind, item.id, "native" in item ? "default" : item.packId);
    if ("native" in item) onEmoji?.(item.emoji);
    else if (kind === "emoji") onEmoji?.(importedEmojiToken(item.id), item.id);
    else onSticker?.(item);
  };
  return <div data-account-pack-picker={kind} className="flex h-full min-h-0 min-w-0 flex-col gap-1">
    <div ref={packStrip} data-text-emoji-packs role="group" aria-label={t(kind === "emoji" ? "Наборы эмодзи" : "Наборы стикеров")}
      className="no-scrollbar flex w-full min-w-0 shrink-0 touch-pan-x items-center justify-start overflow-x-auto overflow-y-hidden overscroll-x-contain cursor-grab active:cursor-grabbing"
      onPointerDown={event => { if (event.pointerType !== "mouse" || event.button !== 0) return; event.currentTarget.scrollTo({ left: event.currentTarget.scrollLeft, behavior: "instant" }); dragged.current = false; drag.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, moved: false }; }}
      onPointerMove={event => {
        const current = drag.current; if (!current || current.id !== event.pointerId || !(event.buttons & 1)) return;
        const delta = event.clientX - current.x; if (!current.moved && Math.abs(delta) < 5) return;
        if (!current.moved) { current.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
        event.preventDefault(); event.currentTarget.scrollLeft = current.left - delta;
      }}
      onPointerUp={event => { if (drag.current?.id === event.pointerId) { dragged.current = drag.current.moved; drag.current = null; } }}
      onPointerCancel={() => { drag.current = null; dragged.current = false; }}
      onClickCapture={event => { if (dragged.current) { dragged.current = false; event.preventDefault(); event.stopPropagation(); } }}>
      {previews.map(pack => <button type="button" key={pack.id} title={pack.title} aria-label={pack.title} aria-pressed={activeId === pack.id} onMouseDown={event => event.preventDefault()} onClick={event => { navigateToPack.current = true; setSelection(pack.id); setNavigationVersion(value => value + 1); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "instant" : "smooth" }); }} className="grid h-9 min-w-0 shrink-0 basis-[12.5%] place-items-center bg-transparent transition-transform active:scale-90">{pack.id === "default" ? <InlineEmoji emoji="😀" size={28} /> : pack.item && <PackMedia item={pack.item} className="size-7 max-w-full" playing={false} />}</button>)}
      {previews.length < 8 && <Link href={`/app?chat=${IMPORTER_BOT_LINK}&chatType=direct`} prefetch={false} data-add-pack title={t("Добавить набор")} aria-label={t("Добавить набор")} className="grid h-9 min-w-0 shrink-0 basis-[12.5%] place-items-center bg-transparent transition-transform active:scale-90"><span className="grid size-7 place-items-center rounded-full bg-white/10 text-zinc-300"><Plus size={16} /></span></Link>}
    </div>
    <label className="mb-0.5 flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/[0.05] px-3 text-zinc-400"><Search size={16} /><input aria-label={t("Поиск в наборе")} value={search} onChange={event => { navigateToPack.current = false; resetScroll(); setSearch(event.target.value); }} placeholder={t("Поиск")} className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none" /></label>
    <div ref={viewport} data-pack-viewport className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" onWheel={() => { navigateToPack.current = false; }} onTouchMove={() => { navigateToPack.current = false; }} onKeyDown={event => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) navigateToPack.current = false; }} onScroll={event => {
      const element = event.currentTarget; if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => { frame.current = null; setView({ top: element.scrollTop, height: element.clientHeight, width: element.clientWidth }); });
    }}>
      <div className="relative" style={{ height: navigationVersion ? Math.max(height, packOffset + view.height) : height }}>
        {rows.filter(row => row.top + row.height >= view.top - rowHeight && row.top <= view.top + view.height + rowHeight).map(row => row.title ? <div key={row.top} data-recent-heading={row.recent || undefined} data-active-pack-heading={!row.recent || undefined} className="absolute flex w-full items-center gap-2 px-2 text-[12px] font-semibold text-zinc-400" style={{ top: row.top, height: row.height }}><span className="min-w-0 truncate">{row.title}</span>{!row.recent && loading && <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />}</div> : <div key={row.top} className="absolute w-full" style={{ top: row.top, height: row.height }}>{row.items?.map((item, index) => <button key={item.id} data-pack-item data-recent-item={row.recent || undefined} type="button" title={item.emoji} aria-label={item.emoji} aria-pressed={selectedId === item.id} onMouseDown={event => event.preventDefault()}
          onClick={() => choose(item)}
          className={`absolute flex items-center justify-center rounded-full bg-transparent ${kind === "emoji" ? "p-1" : "p-2"} transition-transform active:scale-90`} style={{ left: `${index * 100 / columns}%`, width: `${100 / columns}%`, height: rowHeight }}>
          <span aria-hidden className={`absolute inset-1 rounded-full ${selectedId === item.id ? "bg-white/12" : "hover:bg-white/[0.06]"}`} />
          {"native" in item ? <InlineEmoji emoji={item.emoji} size={34} /> : <PackMedia item={item} className={kind === "emoji" ? "size-[34px]" : "size-full"} />}
        </button>)}</div>)}
      </div>
      {!items.length && <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-5 text-center text-[13px] text-zinc-400">
        <span>{t(search ? "Ничего не найдено" : "Добавьте свой первый набор")}</span>
        {!search && <a href={`/app?chat=${IMPORTER_BOT_LINK}&chatType=direct`} className="rounded-full bg-white/8 px-4 py-2 font-medium text-zinc-100">@{IMPORTER_BOT_LINK}</a>}
      </div>}
    </div>
  </div>;
}
