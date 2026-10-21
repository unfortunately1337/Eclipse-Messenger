import { describe, expect, it } from "vitest";
import { botName, botUsername, hashBotToken, issueBotToken } from "./bot-management-validation";
import { revealEclipsePayload } from "./eclipse-payload";
import { encryptAtRest } from "./db-crypto";

describe("bot identity and protected management replies", () => {
  it("normalizes addresses and rejects reserved, malformed and oversized identities", () => {
    expect(botUsername(" @My_Helper_Bot ")).toBe("my_helper_bot");
    expect(botName(" Помощник ")).toBe("Помощник");
    for (const value of ["ECLIPSE", "saved", "api", "123_bot", "a_b", "user_", "я_бот", "a".repeat(33)]) expect(() => botUsername(value)).toThrow();
    for (const value of ["", " ", "a\nb", "a".repeat(65)]) expect(() => botName(value)).toThrow();
  });
  it("issues distinct 256-bit credentials and stores a verification hash", () => {
    const id = "bbf3fe2d-8a22-49b0-b735-7061f2b7a356";
    const first = issueBotToken(id), second = issueBotToken(id);
    expect(first.token).toMatch(/^ecb_[0-9a-f-]{36}\.[\w-]{43}$/);
    expect(first.hash).toBe(hashBotToken(first.token));
    expect(first.hash).not.toContain(first.token);
    expect(second.token).not.toBe(first.token);
  });
  it("requires the bot suffix regardless of letter case, within the existing length limit", () => {
    for (const [input, expected] of [["myroBOT", "myrobot"], ["geminibot", "geminibot"], ["chatgpt_bot", "chatgpt_bot"], [" @My_BoT ", "my_bot"], ["a".repeat(29) + "bot", "a".repeat(29) + "bot"]]) expect(botUsername(input)).toBe(expected);
    for (const value of ["gemini", "chatgpt", "botfather", "chatbot_user", "geminibot1", "bot", "a".repeat(30) + "bot"]) expect(() => botUsername(value)).toThrow();
    expect(() => botUsername("gemini")).toThrow("Юзернейм бота должен оканчиваться на bot.");
  });
  it("keeps token and body out of stored JSON while restoring them for the authenticated owner", () => {
    const token = issueBotToken("bbf3fe2d-8a22-49b0-b735-7061f2b7a356").token;
    const stored = { title: "Ваш бот создан", body: "", eventType: "bot_management", protectedBody: encryptAtRest(JSON.stringify({ body: `Токен: ${token}`, botToken: token })) };
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(revealEclipsePayload(stored)).toMatchObject({ body: `Токен: ${token}`, botToken: token });
    expect(revealEclipsePayload(stored)).not.toHaveProperty("protectedBody");
  });
  it("leaves ordinary security notifications unchanged", () => {
    const notification = { title: "Новый вход", body: "Устройство", eventType: "new_login" };
    expect(revealEclipsePayload(notification)).toBe(notification);
  });
});
