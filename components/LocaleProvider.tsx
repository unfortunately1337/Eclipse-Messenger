"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from "@/lib/i18n/locale";
import { translate, type TranslationValues } from "@/lib/i18n/translate";

type LanguageContext = { locale: Locale; setLocale: (locale: Locale) => void };
const Context = createContext<LanguageContext>({ locale: DEFAULT_LOCALE, setLocale: () => {} });

function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Cookies still preserve the choice when storage is unavailable. */ }
  document.documentElement.lang = locale;
}

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const router = useRouter();
  const setLocale = useCallback((value: Locale) => {
    const next = normalizeLocale(value);
    persistLocale(next);
    updateLocale(next);
    router.refresh();
  }, [router]);
  useEffect(() => {
    document.documentElement.lang = locale;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: "LANGUAGE", locale })).catch(() => {});
    }
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY && (event.newValue === "en" || event.newValue === "ru")) setLocale(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [locale, setLocale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLanguage() { return useContext(Context); }
export function useTranslation() {
  const { locale } = useLanguage();
  return useCallback((source: string, values?: TranslationValues) => translate(source, values, locale), [locale]);
}
