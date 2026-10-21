import type { MetadataRoute } from "next";
import baseManifest from "@/public/manifest.json";
import { getServerLocale } from "@/lib/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getServerLocale();
  const russian = locale === "ru";
  return {
    ...baseManifest,
    lang: locale,
    shortcuts: baseManifest.shortcuts.map(shortcut => ({
      ...shortcut,
      name: russian ? "Чаты" : "Chats",
      short_name: russian ? "Чаты" : "Chats",
      description: russian ? "Открыть чаты Eclipse" : "Open Eclipse chats",
    })),
  } as MetadataRoute.Manifest;
}
