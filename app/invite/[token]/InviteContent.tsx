"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LanguagePicker } from "@/components/LanguagePicker";
import type { InvitePreview } from "@/lib/server/invite-preview";
import { MediaAvatar } from "@/components/ui/media";
import { generateDefaultAvatarDataUrl } from "@/lib/default-avatar";
import { plural } from "@/lib/i18n/translate";
import { useLanguage, useTranslation } from "@/components/LocaleProvider";
import { INVITE_TRANSITION, prepareInviteArrival } from "@/lib/client/invite-transition";
import { Spinner } from "@/components/ui/spinner";
import { TelegramDoodleWallpaper } from "@/app/app/(chats)/components/common/TelegramDoodleWallpaper";
import { apiRequest } from "@/lib/client/http";
import {
  CHAT_THEME_PREVIEW_KEY, CHAT_THEME_SESSION_KEY, DEFAULT_LIVE_BACKGROUND_SETTINGS,
  LIVE_BACKGROUND_STORAGE_KEY, LIVE_BACKGROUND_UPDATED_EVENT, loadLiveBackgroundSettings,
} from "@/lib/client/live-background";
import { customThemeChatBackground, customThemeTextColor } from "@/lib/client/custom-chat-theme";
import { getUiAccentTokensByPreset } from "@/lib/client/theme-accent";

type InviteResponse = { type: "group" | "channel"; link: string };

export default function InviteContent({ token, initialPreview, initialError }: { token: string; initialPreview: InvitePreview | null; initialError: string | null }) {
  const t = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [appearance, setAppearance] = useState(DEFAULT_LIVE_BACKGROUND_SETTINGS);
  const [preview, setPreview] = useState<InvitePreview | null>(initialPreview);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const redirectingRef = useRef(false);
  const generation = useRef(0);
  const [leaving, setLeaving] = useState(false);
  const destination = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [attempt, setAttempt] = useState(0);
  const request = useRef<{ key: string; promise: Promise<InvitePreview> } | null>(null);

  useEffect(() => {
    const sync = () => setAppearance(loadLiveBackgroundSettings({ previewLastTheme: true }));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || [LIVE_BACKGROUND_STORAGE_KEY, CHAT_THEME_SESSION_KEY, CHAT_THEME_PREVIEW_KEY].includes(event.key)) sync();
    };
    sync();
    window.addEventListener(LIVE_BACKGROUND_UPDATED_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LIVE_BACKGROUND_UPDATED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (attempt === 0) return () => { generation.current += 1; };
    const current = ++generation.current;
    let cancelled = false;
    redirectingRef.current = false;
    const key = `${token}:${attempt}`;
    if (request.current?.key !== key) {
      request.current = { key, promise: apiRequest<InvitePreview>(`/api/invite/${encodeURIComponent(token)}`, { method: "GET" }) };
    }
    void request.current.promise.then(data => {
      if (!cancelled && current === generation.current) setPreview(data);
    }).catch(reason => {
      if (!cancelled && current === generation.current) setError(reason instanceof Error ? reason.message : "Не удалось открыть приглашение");
    }).finally(() => { if (!cancelled && current === generation.current) setLoading(false); });
    return () => { cancelled = true; generation.current = current + 1; };
  }, [token, attempt]);

  async function openInEclipse() {
    if (!preview || redirectingRef.current) return;
    const current = generation.current;
    redirectingRef.current = true;
    setRedirecting(true);
    setError(null);
    try {
      const data = await apiRequest<InviteResponse>(`/api/invite/${encodeURIComponent(token)}`, { method: "POST", body: "{}" });
      if (current !== generation.current) return;
      destination.current = `/app?chat=${encodeURIComponent(data.link)}&chatType=${data.type}`;
      prepareInviteArrival(data.link, data.type);
      router.prefetch(destination.current);
      setLeaving(true);
    } catch (reason) {
      if (current !== generation.current) return;
      setError(reason instanceof Error ? reason.message : "Не удалось принять приглашение");
      redirectingRef.current = false;
      setRedirecting(false);
    }
  }

  const customTheme = appearance.customThemeEnabled ? appearance.customTheme : null;
  const accent = getUiAccentTokensByPreset(appearance.neatPreset);
  const buttonColor = customTheme?.outgoingBottom ?? accent.solid;
  const buttonText = customTheme ? customThemeTextColor({ ...customTheme, outgoingTop: customTheme.outgoingBottom }) : accent.contrast;
  const glass = appearance.transparentVisual !== false;
  const count = preview ? new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(preview.count) : "";
  const members = preview ? plural(preview.count, preview.type === "channel" ? ["подписчик", "подписчика", "подписчиков"] : ["участник", "участника", "участников"], preview.type === "channel" ? "subscriber" : "member", locale).replace(String(preview.count), count) : "";

  return (
    <main data-invite-screen className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#0e1016] px-5 py-24 text-zinc-100">
      <TelegramDoodleWallpaper
        presetId={customTheme ? "none" : appearance.neatPreset}
        patternEnabled={customTheme?.backgroundMode !== "image"}
        backgroundOverride={customTheme ? customThemeChatBackground(customTheme) : undefined}
      />

      <LanguagePicker auth />

      <motion.div
        initial={false}
        animate={leaving ? { opacity: 0, y: -10, scale: reducedMotion ? 1 : 0.97 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : INVITE_TRANSITION}
        onAnimationComplete={() => { if (leaving && destination.current) router.replace(destination.current); }}
        className="relative z-10 w-full max-w-[380px]"
      >
        <section
          data-invite-card data-glass={glass} data-leaving={leaving}
          aria-labelledby="invite-title" aria-busy={loading || redirecting}
          className="relative overflow-hidden rounded-[32px] px-6 pb-7 pt-9 text-center shadow-[0_16px_50px_-20px_rgba(0,0,0,0.3)] sm:px-8 sm:pb-8 sm:pt-10"
          style={{ backgroundColor: glass ? "rgba(22,23,28,0.82)" : "#1b1c20", backdropFilter: glass ? "blur(24px) saturate(125%)" : "none" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={loading ? "loading" : preview ? `preview:${preview.link}` : "error"} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
              {loading ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-4" role="status">
                  <Spinner className="size-6" />
                  <span className="sr-only">{t("Загрузка")}</span>
                </div>
              ) : preview ? (
                <>
                  <MediaAvatar src={preview.avatarUrl || generateDefaultAvatarDataUrl(preview.name, preview.link)} alt={preview.name} className="mx-auto size-[100px]" fallbackText={preview.name} imgClassName="text-[32px]" />
                  <h1 id="invite-title" className="mt-5 break-words text-[25px] font-semibold leading-tight tracking-[-0.025em] [overflow-wrap:anywhere]">{preview.name}</h1>
                  <p className="mt-2 text-[14px] text-zinc-400" data-invite-count>{members}</p>
                  {preview.description?.trim() && <p data-invite-description className="mt-5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-200 [overflow-wrap:anywhere]">{preview.description}</p>}
                  {error && <p role="alert" className="mt-4 text-[13px] leading-relaxed text-red-300">{t(error)}</p>}
                  <div className="mt-7 flex flex-col gap-1">
                    <button type="button" disabled={redirecting} onClick={() => void openInEclipse()} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-default disabled:opacity-70" style={{ backgroundColor: buttonColor, color: buttonText }}>
                      {redirecting && <Spinner className="size-4 text-current" />}{redirecting ? t("Перенаправляем…") : preview.type === "channel" ? t("Перейти в канал") : t("Перейти в группу")}
                    </button>
                  </div>
                  <p className="mx-auto mt-4 max-w-[275px] text-[12px] leading-relaxed text-zinc-500">{preview.type === "channel" ? t("Откройте канал в Eclipse, чтобы читать публикации.") : t("Откройте группу в Eclipse, чтобы читать сообщения и общаться.")}</p>
                </>
              ) : (
                <>
                  <h1 id="invite-title" className="text-[25px] font-semibold leading-tight tracking-[-0.035em]">{t("Приглашение недоступно")}</h1>
                  <p role="alert" className="mt-3 text-[14px] leading-relaxed text-zinc-400">{t(error ?? "Не удалось открыть приглашение")}</p>
                  <div className="mt-7 flex flex-col gap-3">
                    <button type="button" onClick={() => { setLoading(true); setError(null); setAttempt(value => value + 1); }} className="min-h-11 cursor-pointer rounded-full px-4 text-[14px] font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: buttonColor, color: buttonText }}>{t("Попробовать снова")}</button>
                    <Link href="/app" className="rounded-full py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:text-white">{t("Вернуться в мессенджер")}</Link>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </motion.div>
    </main>
  );
}
