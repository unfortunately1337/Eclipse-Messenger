/** Plain text only: notification APIs coerce objects to "[object Object]". */
export function messageNotificationPreview(value: unknown, locale = "en", emojiForId?: (id: string) => string | undefined): string {
  const ru = locale === "ru";
  const label = (r: string, e: string) => ru ? r : e;
  let text = typeof value === "string" ? value : "";
  let media: Record<string, unknown> | null = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (text.startsWith("__eclipse_forward__:")) {
    try { const forwarded = JSON.parse(text.slice(20)); text = typeof forwarded.content === "string" ? forwarded.content : ""; } catch { text = ""; }
  }
  if (text.startsWith("__eclipse_media__:")) {
    try { media = JSON.parse(text.slice(18)); } catch { text = ""; }
  }
  const plain = (input: unknown) => typeof input === "string" ? input.replace(/\uE000(tg-[a-f0-9]{24})\uE001/g, (_, id) => emojiForId?.(id) || label("Эмодзи", "Emoji")) : "";
  if (media) {
    const caption = plain(media.caption);
    const type = media.type ?? media.kind;
    if (type === "sticker") {
      const emoji = plain(media.emoji).trim();
      // Accept only short Unicode emoji labels; never a source URL or object.
      text = `${emoji && emoji.length <= 32 && /\p{Extended_Pictographic}/u.test(emoji) ? emoji : "🎭"} ${label("Стикер", "Sticker")}`;
    } else if (type === "image") text = label("Фотография", "Photo") + (caption ? `: ${caption}` : "");
    else if (type === "video") text = label(media.mode === "file" ? "Видеозапись" : "Видеосообщение", media.mode === "file" ? "Video" : "Video message");
    else if (type === "voice") text = label("Голосовое сообщение", "Voice message");
    else if (type === "audio") text = label("Музыка", "Music");
    else if (type === "file") text = label("Файл", "File");
    else if (type === "album") text = label("Альбом", "Album");
    else if (type === "poll") text = label("Опрос", "Poll");
    else if (type === "location") text = label("Местоположение", "Location");
    else text = plain(media.text);
  }
  text = plain(text).trim();
  if (!text || text === "[object Object]" || text.startsWith("__eclipse_")) return label("Новое сообщение", "New message");
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
