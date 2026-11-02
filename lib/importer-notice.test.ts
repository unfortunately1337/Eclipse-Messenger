import { expect, it } from "vitest";
import { importerNoticePayload } from "./importer-notice";
import { localizeSystemText } from "./i18n/translate";

it("marks the importer's own replies as translatable bot notices with their full preview text", () => {
  const text = "Telegram подключён. Отправьте служебному боту стикер или сообщение с кастомным эмодзи — найденный набор появится здесь для подтверждения импорта.";
  const notice = importerNoticePayload(text)!;
  expect(notice.metadata?.importerNotice).toBe(true);
  expect(notice.title).toBe(text);
  expect(localizeSystemText(notice.body, "en")).not.toMatch(/[А-Яа-яЁё]/);
  expect(localizeSystemText(notice.body, "ru")).toBe(text);
});
it("preserves line breaks while translating prompts and their example links", () => {
  const text = "Вставьте ссылку на набор эмодзи\nПример ссылки: https://t.me/addemoji/primer";
  expect(localizeSystemText(importerNoticePayload(text)!.body, "en")).toBe("Paste a link to an emoji pack\nExample link: https://t.me/addemoji/primer");
});
it("leaves imported emoji and stickers in the normal media renderer", () => {
  expect(importerNoticePayload("\uE000tg-012345678901234567890123\uE001")).toBeNull();
  expect(importerNoticePayload('__eclipse_media__:{"type":"sticker"}')).toBeNull();
});
