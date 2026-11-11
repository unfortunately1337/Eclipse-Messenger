import { translate as t } from "@/lib/i18n/translate";

export function getAlbumPreviewLabel(items: Array<{ kind: "image" | "video" }>) {
  const hasImages = items.some((item) => item.kind === "image");
  const hasVideos = items.some((item) => item.kind === "video");
  if (hasImages && hasVideos) return t("Медиаальбом");
  if (hasVideos) return t("Видеоальбом");
  return t("Фотоальбом");
}

export function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
