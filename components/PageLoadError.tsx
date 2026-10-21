"use client";

import { useEffect, useSyncExternalStore } from "react";
import { browserLocale } from "@/lib/i18n/locale";
import { isChunkLoadError } from "@/lib/client/chunk-load-error";
import { recoverStaleChunk } from "@/lib/client/chunk-recovery";

type Props = { error: Error & { digest?: string }; retry?: () => void; reset?: () => void };
const subscribe = () => () => {};
const serverLocale = () => "en";
const readLocale = () => { try { return browserLocale(); } catch { return "en"; } };

/** Intentionally independent of providers, icon catalogues and animation libraries. */
export default function PageLoadError({ error, retry, reset }: Props) {
  const ru = useSyncExternalStore(subscribe, readLocale, serverLocale) === "ru";
  const stale = isChunkLoadError(error);
  useEffect(() => {
    console.error("Page load error:", error);
    recoverStaleChunk(error);
  }, [error]);
  const reload = () => window.location.reload();
  const button = { border: 0, borderRadius: 24, padding: "13px 22px", font: "inherit", cursor: "pointer" };
  return <main lang={ru ? "ru" : "en"} style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box", color: "#f4f4f5", background: "#111214", fontFamily: "Arial, sans-serif" }}>
    <section style={{ maxWidth: 380, textAlign: "center" }}>
      <img src="/brand/hello_dark.png" alt="Eclipse" width={72} height={72} style={{ objectFit: "contain", marginBottom: 16 }} />
      <h1 style={{ fontSize: 24, lineHeight: 1.3 }}>{stale ? (ru ? "Eclipse обновился" : "Eclipse has been updated") : (ru ? "Не удалось открыть страницу" : "Could not open this page")}</h1>
      <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>{ru ? "Попробуйте ещё раз. Если ошибка повторится, обновите страницу." : "Please try again. If the problem persists, reload the page."}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 24 }}>
        <button type="button" style={{ ...button, background: "#f4f4f5", color: "#18181b" }} onClick={stale ? reload : (retry ?? reset ?? reload)}>{ru ? "Повторить" : "Try again"}</button>
        {!stale && <button type="button" style={{ ...button, background: "#27272a", color: "#f4f4f5" }} onClick={reload}>{ru ? "Обновить страницу" : "Reload page"}</button>}
      </div>
      {error.digest && <p style={{ color: "#71717a", fontSize: 12, marginTop: 24 }}>ID: {error.digest}</p>}
    </section>
  </main>;
}
