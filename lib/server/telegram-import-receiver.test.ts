import { beforeEach, afterEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ upsert: vi.fn(), state: vi.fn(), request: vi.fn(), inspect: vi.fn(), reply: vi.fn(), redeem: vi.fn(), offer: vi.fn(), invite: vi.fn(), user: vi.fn() }));
vi.mock("./telegram-channel-invite", () => ({ maybeInviteToEclipseChannel: fake.invite }));
vi.mock("./prisma", () => ({ prisma: { telegramImportUpdate: { upsert: fake.upsert }, packImporterState: { findUnique: fake.state }, user: { findUnique: fake.user } } }));
vi.mock("./db-crypto", () => ({ encryptAtRest: (s: string) => `encrypted:${s}`, decryptAtRest: (s: string) => s.slice(10) }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("./telegram-pack-import", () => ({ telegramRequest: fake.request, inspectTelegramPack: fake.inspect }));
vi.mock("./telegram-import-link", () => ({ telegramImporterBotId: () => "123", redeemTelegramImportLink: fake.redeem }));
vi.mock("./pack-importer-bot", () => ({ ensureImporterBotUser: async () => ({ id: "system:importbot" }), writeImporterReply: fake.reply, offerImporterPack: fake.offer }));
vi.mock("./chat", () => ({ getOrCreateDirectConversation: async () => "conversation" }));
import { detectTelegramImportPacks, enqueueTelegramImportUpdate, receiveTelegramImportUpdate, verifyTelegramImporterWebhook } from "./telegram-import-receiver";
const message = { message_id: 7, from: { id: 42 }, chat: { id: 42, type: "private" } };
const encrypted = (value: unknown) => `encrypted:${JSON.stringify(value)}`;
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("TELEGRAM_IMPORT_WEBHOOK_SECRET", "a".repeat(43)); fake.request.mockResolvedValue({}); fake.offer.mockResolvedValue(true); });
afterEach(() => vi.unstubAllEnvs());
it("authenticates Telegram's secret header before accepting any update", () => {
  expect(() => verifyTelegramImporterWebhook("a".repeat(43))).not.toThrow();
  for (const header of [null, "", "wrong", "b".repeat(43)]) expect(() => verifyTelegramImporterWebhook(header)).toThrow("Forbidden");
});
it("deduplicates updates by bot identity and update ID and strips unrelated forwarded details", async () => {
  await enqueueTelegramImportUpdate({ update_id: 12, message: { ...message, sticker: { set_name: "Ducks", type: "regular" }, forward_origin: { sender_user: { first_name: "Private name" } } } });
  const call = fake.upsert.mock.calls[0][0];
  expect(call.where).toEqual({ id: "tg-123-12" }); expect(call.update).toEqual({});
  expect(call.create.payloadEnc).not.toContain("Private name");
});
it("ignores group messages, bots and sender/chat mismatches", async () => {
  for (const changed of [{ chat: { id: -1, type: "group" } }, { from: { id: 42, is_bot: true } }, { chat: { id: 43, type: "private" } }]) await enqueueTelegramImportUpdate({ update_id: 1, message: { ...message, ...changed } });
  expect(fake.upsert).not.toHaveBeenCalled();
});
it("finds a whole sticker pack without requiring a copied link", async () => {
  await expect(detectTelegramImportPacks({ ...message, sticker: { set_name: "Ducks", type: "regular" } })).resolves.toEqual([{ name: "Ducks", kind: "sticker" }]);
  expect(fake.request).not.toHaveBeenCalled();
});
it("resolves custom emoji from text and captions and deduplicates their packs", async () => {
  fake.request.mockResolvedValue([{ set_name: "MasksEmoji", type: "custom_emoji" }, { set_name: "MasksEmoji", type: "custom_emoji" }, { type: "custom_emoji" }]);
  const packs = await detectTelegramImportPacks({ ...message, entities: [{ type: "custom_emoji", custom_emoji_id: "1234" }], caption_entities: [{ type: "custom_emoji", custom_emoji_id: "1234" }] });
  expect(packs).toEqual([{ name: "MasksEmoji", kind: "emoji" }]);
  expect(fake.request).toHaveBeenCalledWith("getCustomEmojiStickers", { custom_emoji_ids: '["1234"]' });
});
it("does not invent a pack for plain emoji, mask stickers or an unlabelled file", async () => {
  expect(await detectTelegramImportPacks({ ...message, text: "🙂" })).toEqual([]);
  expect(await detectTelegramImportPacks({ ...message, sticker: { set_name: "Masks", type: "mask" } })).toEqual([]);
});
it("requires an Eclipse link before processing stickers", async () => {
  fake.state.mockResolvedValue(null);
  await receiveTelegramImportUpdate("event", encrypted({ update_id: 1, message: { ...message, sticker: { set_name: "Ducks", type: "regular" } } }));
  expect(fake.inspect).not.toHaveBeenCalled(); expect(fake.reply).not.toHaveBeenCalled();
  expect(fake.request.mock.calls[0][0]).toBe("sendMessage");
  expect(fake.invite).toHaveBeenCalledExactlyOnceWith(42, undefined);
});
it("never sends the channel suggestion to groups, bots or mismatched private senders", async () => {
  for (const changed of [{ chat: { id: -1, type: "group" } }, { from: { id: 42, is_bot: true } }, { chat: { id: 43, type: "private" } }]) await receiveTelegramImportUpdate("invalid", encrypted({ update_id: 1, message: { ...message, ...changed } }));
  expect(fake.invite).not.toHaveBeenCalled(); expect(fake.request).not.toHaveBeenCalled();
});
it("uses the Telegram user's language for its own instructions", async () => {
  fake.state.mockResolvedValue(null);
  await receiveTelegramImportUpdate("english", encrypted({ update_id: 2, message: { ...message, from: { id: 42, language_code: "en" } } }));
  expect(fake.request.mock.lastCall![1].text).not.toMatch(/[А-Яа-яЁё]/);
  await receiveTelegramImportUpdate("russian", encrypted({ update_id: 3, message: { ...message, from: { id: 42, language_code: "ru" } } }));
  expect(fake.request.mock.lastCall![1].text).toContain("Сначала откройте");
});
it("creates an idempotent confirmation card instead of installing a pack automatically", async () => {
  fake.state.mockResolvedValue({ userId: "user", telegramAccount: "123:42" });
  fake.inspect.mockResolvedValue({ id: "pack-id", title: "Ducks", count: 30, kind: "sticker" });
  await receiveTelegramImportUpdate("event", encrypted({ update_id: 1, message: { ...message, sticker: { set_name: "Ducks", type: "regular" } } }));
  expect(fake.offer).toHaveBeenCalledWith("user", "conversation", expect.objectContaining({ title: "Ducks", count: 30 }), "telegram-pack:event:pack-id");
  expect(fake.request.mock.lastCall![1].text).toBe("Pack “Ducks” found. Return to Eclipse and press Import.");
});
it("confirms the linked Eclipse username in Russian without decorative dashes", async () => {
  fake.redeem.mockResolvedValue("user"); fake.user.mockResolvedValue({ link: "creepy" });
  await receiveTelegramImportUpdate("linked", encrypted({ update_id: 5, message: { ...message, from: { id: 42, language_code: "ru" }, text: "/start import_" + "a".repeat(32) } }));
  expect(fake.user).toHaveBeenCalledWith({ where: { id: "user" }, select: { link: true } });
  const text = fake.request.mock.lastCall![1].text;
  expect(text).toBe("Ваш аккаунт привязан к @creepy в Eclipse.\nОтправьте стикер, кастомный эмодзи или ссылку на набор для импорта в Eclipse.");
  expect(text).not.toMatch(/--|—/);
});
it("shows the existing linked account on /start without rebinding and defaults to English", async () => {
  fake.state.mockResolvedValue({ userId: "user", telegramAccount: "123:42" }); fake.user.mockResolvedValue({ link: "my_user" });
  await receiveTelegramImportUpdate("start", encrypted({ update_id: 6, message: { ...message, text: "/start" } }));
  const text = fake.request.mock.lastCall![1].text;
  expect(text).toContain("Your account is linked to @my_user in Eclipse."); expect(text).not.toMatch(/[А-Яа-яЁё]|--|—/);
  expect(fake.redeem).not.toHaveBeenCalled();
});
it("names every detected pack in a multi-pack reply", async () => {
  fake.state.mockResolvedValue({ userId: "user", telegramAccount: "123:42" });
  fake.inspect.mockResolvedValueOnce({ id: "pack-ducks", title: "Ducks", count: 30, kind: "sticker" }).mockResolvedValueOnce({ id: "pack-masks", title: "Masks", count: 20, kind: "emoji" });
  await receiveTelegramImportUpdate("multi", encrypted({ update_id: 7, message: { ...message, from: { id: 42, language_code: "ru" }, sticker: { set_name: "Ducks", type: "regular" }, text: "https://t.me/addemoji/MasksEmoji" } }));
  expect(fake.request.mock.lastCall![1].text).toBe("Найдены наборы: «Ducks», «Masks». Вернитесь в Eclipse и нажмите «Импортировать» в нужных карточках.");
});
it("does not invite the user to import again when the account already owns every detected pack", async () => {
  fake.state.mockResolvedValue({ userId: "user", telegramAccount: "123:42" });
  fake.inspect.mockResolvedValue({ id: "pack-id", title: "Ducks", count: 30, kind: "sticker" });
  fake.offer.mockResolvedValue(false);
  await receiveTelegramImportUpdate("duplicate", encrypted({ update_id: 4, message: { ...message, from: { id: 42, language_code: "en" }, sticker: { set_name: "Ducks", type: "regular" } } }));
  expect(fake.request.mock.lastCall![1].text).toBe("These packs are already in your Eclipse account.");
});
it("stops creating cards when the account was disconnected during detection", async () => {
  fake.state.mockResolvedValueOnce({ userId: "user", telegramAccount: "123:42" }).mockResolvedValueOnce({ telegramAccount: null });
  fake.inspect.mockResolvedValue({ id: "pack-id", title: "Ducks", count: 30, kind: "sticker" });
  await receiveTelegramImportUpdate("event", encrypted({ update_id: 1, message: { ...message, sticker: { set_name: "Ducks", type: "regular" } } }));
  expect(fake.reply).not.toHaveBeenCalled();
});
