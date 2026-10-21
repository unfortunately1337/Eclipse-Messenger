"use client";
import { getReplyLineColor } from "@/lib/reply-colors";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus } from "lucide-react";
import { CustomChatTheme, customThemeMessageBackground, customThemeChatBackground, customThemeTextColor } from "@/lib/client/custom-chat-theme";
import { compressImageFile } from "@/lib/client/media-compression";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PANEL_SUBVIEW_VARIANTS, PANEL_TRANSITION } from "@/lib/client/panel-motion";
import { MessageBubbleTail } from "./MessageBubbles";
import { ReplyQuote } from "./ReplyQuote";
import { PanelNavigation } from "./PanelNavigation";

export function CustomChatThemeEditor({ initial, onCancel, onSave }: {
  initial: CustomChatTheme; onCancel: () => void; onSave: (theme: CustomChatTheme) => void;
}) {
  const t = useTranslation();
  const [draft, setDraft] = useState(initial);
  const reduced = useReducedMotion();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  const incoming = draft.incoming || "#212121";
  const outgoing = customThemeMessageBackground(draft);
  const outgoingPreviewRef = useRef<HTMLDivElement>(null);
  const [outgoingPreviewHeight, setOutgoingPreviewHeight] = useState(36);
  useLayoutEffect(() => {
    const element = outgoingPreviewRef.current;
    if (!element) return;
    const measure = () => setOutgoingPreviewHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  async function uploadWallpaper(file?: File) {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    setUploading(true); setError("");
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error(t("Выберите JPG, PNG или WebP до 20 МБ."));
      const result = await compressImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8, targetMimeType: "image/webp" });
      try {
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(t("Не удалось открыть обои."))); reader.readAsDataURL(result.file); });
        if (data.length > 2_000_000) throw new Error(t("Изображение слишком большое. Выберите обои меньшего размера."));
        if (sequence === uploadSequence.current) setDraft(prev => ({ ...prev, wallpaper: data, backgroundMode: "image" }));
      } finally { URL.revokeObjectURL(result.previewUrl); }
    } catch (err) { if (sequence === uploadSequence.current) setError(err instanceof Error ? err.message : t("Не удалось загрузить обои.")); }
    finally { if (sequence === uploadSequence.current) setUploading(false); }
  }
  return <section className="flex h-full min-h-0 flex-col bg-transparent" aria-label={t("Создание темы")}>
    <header className="flex h-14 shrink-0 items-center gap-3 px-4">
      <button type="button" aria-label={t("Отменить создание темы")} onClick={onCancel} className="grid h-10 w-10 place-items-center cursor-pointer"><ArrowLeft size={22} /></button>
      <h2 className="flex-1 text-[19px] font-semibold">{t("Своя тема")}</h2>
      <button type="button" aria-label={t("Сохранить тему")} disabled={uploading || (draft.backgroundMode === "image" && !draft.wallpaper)} onClick={() => {
        try { onSave({ ...draft, name: draft.name.trim() || t("Моя тема") }); } catch { setError(t("Не удалось сохранить тему. Освободите место в браузере или выберите другие обои.")); }
      }} className="grid h-10 w-10 place-items-center cursor-pointer disabled:opacity-40"><Check size={24} /></button>
    </header>
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
      <div className="relative flex min-h-[170px] flex-col justify-center gap-3 overflow-hidden rounded-[24px] p-5" style={{ "--incoming-message-background": incoming } as React.CSSProperties}>
        <AnimatePresence initial={false}>
          <motion.div key={draft.backgroundMode || 'solid'} aria-hidden className="absolute inset-0" style={{ background: customThemeChatBackground(draft) }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduced ? { duration: 0 } : PANEL_TRANSITION} />
        </AnimatePresence>
        {draft.backgroundMode !== "image" && <div aria-hidden className="pointer-events-none absolute inset-0 opacity-35" style={{ background: "rgba(255,255,255,0.6)", maskImage: "url('/chat-bg-official.svg')", WebkitMaskImage: "url('/chat-bg-official.svg')", maskSize: "140px auto", WebkitMaskSize: "140px auto", maskRepeat: "repeat", WebkitMaskRepeat: "repeat" }} />}
        <div className="relative self-start rounded-[16px] rounded-bl-none px-3 py-2 text-[14px]" style={{ background: incoming, color: customThemeTextColor({ ...draft, outgoingTop: incoming, outgoingBottom: incoming }) }}><MessageBubbleTail isMine={false} hasTail fillColor={incoming} />{t("Как тебе новая тема?")}</div>
        <div ref={outgoingPreviewRef} className="relative self-end rounded-[16px] rounded-br-none px-3 py-2 text-[14px]" style={{ background: outgoing, color: customThemeTextColor(draft) }}>
          <MessageBubbleTail isMine hasTail mineGradientStyle={{ background: outgoing }} gradientColors={[draft.outgoingTop, draft.outgoingBottom]} surfaceHeight={outgoingPreviewHeight} />
          <ReplyQuote author={t("Александр")} preview={t("Как тебе новая тема?")}
            background={draft.replyBackground || "rgba(255,255,255,0.12)"}
            lineColor={getReplyLineColor(draft.replyBackground || outgoing, draft.replyLine)}
            authorColor={draft.replyBackground ? customThemeTextColor({ ...draft, outgoingTop: draft.replyBackground, outgoingBottom: draft.replyBackground }) : customThemeTextColor(draft)}
            previewColor={draft.replyBackground ? customThemeTextColor({ ...draft, outgoingTop: draft.replyBackground, outgoingBottom: draft.replyBackground }) : customThemeTextColor(draft)} />
          {t("Это мои цвета!")}</div>
      </div>
      <div className="rounded-[24px] bg-white/[0.04] p-4 space-y-3">
        <label className="block rounded-[18px] border border-white/[0.08] bg-transparent px-4 py-3.5 transition-colors focus-within:border-[var(--ui-accent-solid,#38bdf8)]">
          <input aria-label={t("Название темы")} placeholder={t("Название темы")} autoComplete="off" maxLength={32} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500" />
        </label>

      </div>
      <div className="flex gap-1 rounded-[18px] bg-white/[0.04] p-1" role="group" aria-label={t("Фон темы")}>
        {([['solid', t("Однотонный")], ['gradient', t("Градиент")], ['image', t("Обои")]] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={(draft.backgroundMode || 'solid') === mode} onClick={() => setDraft({ ...draft, backgroundMode: mode })} className={`flex-1 rounded-[14px] py-2.5 text-[12px] cursor-pointer transition-colors duration-300 ${(draft.backgroundMode || 'solid') === mode ? 'bg-white/10 text-white' : 'text-zinc-400'}`}>{label}</button>)}
      </div>
      <PanelNavigation>
      <motion.div key={draft.backgroundMode || 'solid'} variants={PANEL_SUBVIEW_VARIANTS} initial={reduced ? false : "initial"} animate="animate" exit="exit" className="space-y-4">
      {draft.backgroundMode === 'image' && <>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { void uploadWallpaper(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/20 py-3 text-[14px] cursor-pointer"><ImagePlus size={20} />{uploading ? t("Подготавливаем обои…") : draft.wallpaper ? t("Заменить обои") : t("Загрузить свои обои")}</button>
      </>}
      <div className="space-y-3 rounded-[24px] bg-white/[0.04] p-4">
        {([...(draft.backgroundMode === 'image' ? [] : [['background', draft.backgroundMode === 'gradient' ? t("Фон · первый цвет") : t("Фон чата")]]), ...(draft.backgroundMode === 'gradient' ? [['backgroundBottom', t("Фон · второй цвет")]] : []), ['incoming', t("Чужие сообщения")], ['outgoingTop', t("Ваши сообщения · верх")], ['outgoingBottom', t("Ваши сообщения · низ")], ['replyBackground', t("Поле ответа на сообщение")], ['replyLine', t("Цвет линии ответа")]] as [keyof CustomChatTheme, string][]).map(([key, label]) => <label key={key} className="relative flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-white/[0.08] bg-transparent px-4 py-3 transition-colors focus-within:border-[var(--ui-accent-solid,#38bdf8)]">
          <span className="text-[14px]">{label}</span>
          <span className="flex shrink-0 items-center gap-2"><span className="text-[11px] uppercase text-zinc-400">{String(draft[key] || '#212121')}</span><span className="h-7 w-7 rounded-full border border-white/15" style={{ background: String(draft[key] || '#212121') }} /></span>
          <input aria-label={label} type="color" value={String(draft[key] || '#212121')} onChange={e => { const color = e.target.value; setDraft(previous => ({ ...previous, [key]: color })); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>)}
      </div>
      {draft.backgroundMode === 'gradient' && <label className="block px-1 text-[13px] text-zinc-400">{t("Направление градиента · ")}{draft.backgroundAngle ?? 135}°<input aria-label={t("Направление градиента")} className="mt-3 w-full" type="range" min={0} max={360} value={draft.backgroundAngle ?? 135} onChange={e => setDraft({ ...draft, backgroundAngle: Number(e.target.value) })} /></label>}
      </motion.div>
      </PanelNavigation>
      {error && <p role="alert" className="text-[13px] text-red-400">{t(error ?? "")}</p>}
      <p className="px-1 text-[12px] leading-5 text-zinc-400">{t("Тема и обои видны только вам в текущей сессии браузера. Галочка применяет изменения; стрелка отменяет.")}</p>
    </div>
  </section>;
}
