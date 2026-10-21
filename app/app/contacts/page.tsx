
import { translate as t } from "@/lib/i18n/translate";
import { getServerTranslation } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata() {
  const t = await getServerTranslation();
  return {
  title: t("Контакты"),
};
}

export default async function ContactsPage() {
  const t = await getServerTranslation();
  return (
    <div className="px-3 md:px-5">
      <div className="mx-auto max-w-3xl p-1 md:p-3 space-y-4">
        <h1 className="text-2xl font-black">{t("Контакты")}</h1>
        <p className="text-sm text-zinc-500">{t("Контактов пока нет.")}</p>
      </div>
    </div>
  );
}
