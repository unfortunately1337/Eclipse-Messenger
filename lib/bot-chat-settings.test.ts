import { describe, expect, it } from "vitest";
import { botChatSettingsSchema, DEFAULT_BOT_CHAT_SETTINGS, resolveBotChatSettings } from "./bot-chat-settings";

describe("bot chat customization", () => {
  it("inherits unspecified fields and allows deliberate removal of the panel or menu", () => {
    const global = { empty_text: "Музыкальный помощник", input_placeholder: "Название песни", menu: { type: "keyboard", keyboard: [[{ text: "Помощь", message: "/help" }]] } };
    expect(resolveBotChatSettings(global, { input_placeholder: "Выберите действие" })).toMatchObject({ empty_text: "Музыкальный помощник", input_placeholder: "Выберите действие", menu: global.menu });
    expect(resolveBotChatSettings(global, { empty_text: "", menu: { type: "none" } })).toMatchObject({ empty_text: "", menu: { type: "none" } });
    expect(resolveBotChatSettings({}, null)).toEqual(DEFAULT_BOT_CHAT_SETTINGS);
  });
  it("bounds layouts and rejects ambiguous actions, unsafe URLs and forged media", () => {
    const invalidButtons = [
      { text: "x", url: "javascript:alert(1)" },
      { text: "x", callback_data: "😀".repeat(17) },
      { text: "x", callback_data: "x", message: "/help" },
      { text: "x", message: '__eclipse_media__:{"type":"image"}' },
    ];
    for (const button of invalidButtons) expect(botChatSettingsSchema.safeParse({ menu: { type: "keyboard", keyboard: [[button]] } }).success).toBe(false);
    for (const keyboard of [[], [[]], [Array.from({ length: 5 }, () => ({ text: "x" }))], Array.from({ length: 9 }, () => [{ text: "x" }])]) expect(botChatSettingsSchema.safeParse({ menu: { type: "keyboard", keyboard } }).success).toBe(false);
    expect(botChatSettingsSchema.safeParse({ menu: { type: "keyboard", keyboard: [[{ text: "x", callback_data: "😀".repeat(16) }, { text: "x" }]] } }).success).toBe(true);
    expect(botChatSettingsSchema.safeParse({ input_placeholder: "one\ntwo" }).success).toBe(false);
    expect(botChatSettingsSchema.safeParse({ empty_text: "x".repeat(2049) }).success).toBe(false);
  });
});
