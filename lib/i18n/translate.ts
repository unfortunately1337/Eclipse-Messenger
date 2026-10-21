import en from "./en.json";
import { browserLocale, type Locale } from "./locale";

export type TranslationValues = Record<string | number, string | number | null | undefined>;
const english: Record<string, string> = en;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let templates: Array<{ pattern: RegExp; names: string[]; translation: string }> | undefined;
function translateTemplate(source: string) {
  if (source.length > 8192) return undefined;
  templates ??= Object.entries(english).filter(([key]) => /\{\d+\}/.test(key) && key.replace(/\{\d+\}/g, "").trim().length >= 8)
    .sort(([a], [b]) => b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length)
    .map(([key, translation]) => {
    const names: string[] = [];
    const parts = key.split(/(\{\d+\})/g).map(part => {
      if (/^\{\d+\}$/.test(part)) { names.push(part.slice(1, -1)); return "(.{1,1024}?)"; }
      return escapeRegex(part);
    });
    return { pattern: new RegExp(`^${parts.join("")}$`, "u"), names, translation };
  });
  for (const template of templates) {
    const match = template.pattern.exec(source);
    if (!match) continue;
    return template.translation.replace(/\{(\d+)\}/g, (token, name: string) => match[template.names.indexOf(name) + 1] ?? token);
  }
  return undefined;
}

/** Translate only application-owned labels. Never apply this to message content. */
export function translate(source: string, values?: TranslationValues, locale: Locale = browserLocale()): string {
  if (!source.trim()) return source;
  const key = normalize(source);
  const translated = locale === "en" ? ((Object.hasOwn(english, key) ? english[key] : undefined) ?? (/[А-Яа-яЁё]/.test(key) ? translateTemplate(key) : undefined) ?? source.trim()) : source.trim();
  const text = source.slice(0, source.length - source.trimStart().length) + translated + source.slice(source.trimEnd().length);
  return values ? text.replace(/\{(\d+|[a-zA-Z]\w*)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name] ?? "") : match) : text;
}

export function localizeSystemText(source: string, locale: Locale = browserLocale()) {
  if (locale === "ru") return source;
  // Older service notices contain formatted dates rather than timestamps.
  // Preserve the recorded wall-clock time while changing its presentation.
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  source = source.replace(/(\d{1,2}) ([а-я]+) (\d{4})\s*г\.?[,]?\s*(?:в\s*)?(\d{1,2}):(\d{2})/gu, (original, day: string, month: string, year: string, hour: string, minute: string) => {
    const index = months.indexOf(month);
    if (index < 0) return original;
    const date = new Date(Date.UTC(Number(year), index, Number(day), Number(hour), Number(minute)));
    if (date.getUTCMonth() !== index || date.getUTCDate() !== Number(day)) return original;
    return date.toLocaleString("en-US", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  });
  // Match templates per line: a generic date placeholder must not swallow
  // the remaining paragraphs of a service notification.
  if (/\r?\n/.test(source)) return source.split(/(\r?\n)/).map(line => translate(line, undefined, locale)).join("");
  const whole = translate(source, undefined, locale);
  if (whole !== source) return whole;
  return source.split(/(\r?\n)/).map(line => translate(line, undefined, locale)).join("");
}

export function dateLocale(locale: Locale = browserLocale()) { return locale === "ru" ? "ru-RU" : "en-US"; }

export function plural(count: number, russian: readonly [string, string, string], englishWord: string, locale: Locale = browserLocale()) {
  if (locale === "en") return `${count} ${englishWord}${count === 1 ? "" : "s"}`;
  const mod10 = Math.abs(count) % 10, mod100 = Math.abs(count) % 100;
  return `${count} ${russian[mod10 === 1 && mod100 !== 11 ? 0 : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 1 : 2]}`;
}
