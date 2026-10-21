import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "./locale";
import { translate, type TranslationValues } from "./translate";

export async function getServerLocale() { return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value); }
export async function getServerTranslation() {
  const locale = await getServerLocale();
  return (source: string, values?: TranslationValues) => translate(source, values, locale);
}
