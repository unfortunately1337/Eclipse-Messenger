import { expect, it } from "vitest";
import { IMPORTER_EMPTY_TEXT, IMPORTER_HELP_TEXT, IMPORTER_GREETING } from "./importer-copy";
import { localizeSystemText } from "./i18n/translate";

it("localizes the greeting and unified Telegram help while preserving commands", () => {
  const english = localizeSystemText(`${IMPORTER_EMPTY_TEXT}\n${IMPORTER_GREETING}\n${IMPORTER_HELP_TEXT}`, "en");
  expect(english).not.toMatch(/[А-Яа-яЁё]/);
  expect(english).toContain("/start"); expect(english).toContain("/help");
  expect(english).toContain("sticker and custom emoji packs");
  expect(IMPORTER_HELP_TEXT).not.toContain("Выберите «Эмодзи»");
  expect(IMPORTER_HELP_TEXT).not.toContain("Выберите «Стикеры»");
  expect(english).toContain("link is valid for 5 minutes");
  expect(localizeSystemText(IMPORTER_HELP_TEXT, "ru")).toBe(IMPORTER_HELP_TEXT);
});
