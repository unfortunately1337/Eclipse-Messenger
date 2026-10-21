export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "eclipse.locale";
export const LOCALE_STORAGE_KEY = "eclipse:language:v1";
export function normalizeLocale(value: unknown): Locale {
  return value === "ru" ? "ru" : "en";
}
export function browserLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return normalizeLocale(document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1]);
}
