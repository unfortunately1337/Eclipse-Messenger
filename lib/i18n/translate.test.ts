import { describe, expect, it, afterEach, vi } from "vitest";
import en from "./en.json";
import { browserLocale, normalizeLocale } from "./locale";
import { localizeSystemText, plural, translate } from "./translate";

afterEach(() => vi.unstubAllGlobals());
describe("application localization", () => {
  it("defaults to English and accepts only the supported locales", () => {
    expect(browserLocale()).toBe("en");
    for (const value of [null, undefined, "de", "EN", "<script>"]) expect(normalizeLocale(value)).toBe("en");
    expect(normalizeLocale("ru")).toBe("ru");
    vi.stubGlobal("document", { cookie: "other=1; eclipse.locale=ru; session=example" });
    expect(browserLocale()).toBe("ru");
    expect(translate("Сообщение")).toBe("Сообщение");
  });
  it("translates labels while preserving Russian and intentional inline spacing", () => {
    expect(translate("Сообщение", undefined, "en")).toBe("Message");
    expect(translate("Сообщение", undefined, "ru")).toBe("Сообщение");
    expect(translate("Откройте ", undefined, "en")).toBe("Open ");
    expect(translate(" и нажмите ", undefined, "en")).toBe(" and tap ");
    expect(translate("constructor", undefined, "en")).toBe("constructor");
    expect(translate("__proto__", undefined, "en")).toBe("__proto__");
  });
  it("preserves inserted names and values without interpreting them as translations", () => {
    expect(translate("Открыть профиль {0}", { 0: "Привет {1}" }, "en")).toBe("Open Привет {1}'s profile");
    expect(translate("{0} из {1}", { 0: 2, 1: 14 }, "ru")).toBe("2 из 14");
  });
  it("prefers specific server message templates over generic date and count phrases", () => {
    expect(translate("Настройки бота @fixture. Выберите действие в меню.", undefined, "en")).toBe("Settings for @fixture. Choose an action from the menu.");
    expect(translate("Вы пригласили Александр в секретный чат.", undefined, "en")).toBe("You invited Александр to a secret chat.");
    expect(localizeSystemText("Служебные уведомления\nНеверный пароль", "en")).toBe("Service notifications\nIncorrect password");
    expect(localizeSystemText("Дата и время: 15 октября 2026 г. в 17:12\n\nДвухфакторная защита активна.", "en")).toBe("Date and time: October 15, 2026 at 05:12 PM\n\nTwo-factor protection is active.");
  });
  it("uses independent English and Russian plural rules", () => {
    for (const count of [0, 2, 5, 11, 21, 101]) expect(plural(count, ["сообщение", "сообщения", "сообщений"], "message", "en")).toBe(`${count} messages`);
    expect(plural(1, ["сообщение", "сообщения", "сообщений"], "message", "en")).toBe("1 message");
    expect(plural(21, ["сообщение", "сообщения", "сообщений"], "message", "ru")).toBe("21 сообщение");
    expect(plural(14, ["сообщение", "сообщения", "сообщений"], "message", "ru")).toBe("14 сообщений");
  });
  it("has complete, nonempty English entries with all interpolation slots preserved", () => {
    for (const [source, translation] of Object.entries(en)) {
      expect(translation.trim(), source).not.toBe("");
      expect(translation, source).not.toMatch(/[А-Яа-яЁё]/);
      expect((translation.match(/\{\d+\}/g) ?? []).sort(), source).toEqual((source.match(/\{\d+\}/g) ?? []).sort());
    }
  });
});
