import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ claim: vi.fn(), request: vi.fn() }));
vi.mock("./redis", () => ({ redis: { setIfAbsent: fake.claim } }));
vi.mock("./telegram-pack-import", () => ({ telegramRequest: fake.request }));
vi.mock("./telegram-import-link", () => ({ telegramImporterBotId: () => "123" }));
import { ECLIPSE_TELEGRAM_CHANNEL, maybeInviteToEclipseChannel } from "./telegram-channel-invite";

beforeEach(() => { vi.resetAllMocks(); fake.claim.mockResolvedValue(true); fake.request.mockResolvedValue({}); });
afterEach(() => vi.useRealTimers());
it("sends a quiet optional Russian invitation with an inline link to the Eclipse channel", async () => {
  await maybeInviteToEclipseChannel(42, "ru-RU");
  expect(fake.request).toHaveBeenCalledOnce();
  const [method, args] = fake.request.mock.lastCall!;
  expect(method).toBe("sendMessage"); expect(args.chat_id).toBe("42");
  expect(args.text).toContain("Подписка необязательна"); expect(args.disable_notification).toBe("true");
  expect(JSON.parse(args.reply_markup)).toEqual({ inline_keyboard: [[{ text: "Подписаться", url: ECLIPSE_TELEGRAM_CHANNEL }]] });
  expect(ECLIPSE_TELEGRAM_CHANNEL).toBe("https://t.me/eclipsemessenger");
  const [key, value, seconds] = fake.claim.mock.lastCall!;
  expect(key).toMatch(/^telegram-import:channel-invite:v1:123:[a-f0-9]{64}$/); expect(value).toBe("shown");
  expect(seconds).toBeGreaterThanOrEqual(30 * 86400); expect(seconds).toBeLessThanOrEqual(60 * 86400);
});
it("uses English by default and localizes the button too", async () => {
  await maybeInviteToEclipseChannel(42);
  const args = fake.request.mock.lastCall![1]; expect(args.text).not.toMatch(/[А-Яа-яЁё]/);
  expect(JSON.parse(args.reply_markup).inline_keyboard[0][0].text).toBe("Subscribe");
});
it("claims once across concurrent updates and only becomes eligible after its full cooldown", async () => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000);
  const deadlines = new Map<string, number>();
  fake.claim.mockImplementation(async (key, _value, seconds) => {
    if ((deadlines.get(key) ?? 0) > Date.now()) return false;
    deadlines.set(key, Date.now() + seconds * 1000); return true;
  });
  await Promise.all([maybeInviteToEclipseChannel(42), maybeInviteToEclipseChannel(42)]);
  expect(fake.request).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now() + 29 * 86400 * 1000); await maybeInviteToEclipseChannel(42);
  expect(fake.request).toHaveBeenCalledOnce();
  vi.setSystemTime([...deadlines.values()][0] + 1); await maybeInviteToEclipseChannel(42);
  expect(fake.request).toHaveBeenCalledTimes(2);
});
it("does not send a suggestion when the cooldown cannot be checked", async () => {
  fake.claim.mockRejectedValue(new Error("Redis unavailable"));
  await expect(maybeInviteToEclipseChannel(42)).resolves.toBeUndefined(); expect(fake.request).not.toHaveBeenCalled();
});
it("does not fail imports or retry the invitation after an ambiguous Telegram failure", async () => {
  fake.claim.mockResolvedValueOnce(true).mockResolvedValue(false); fake.request.mockRejectedValue(new Error("Timeout"));
  await expect(maybeInviteToEclipseChannel(42)).resolves.toBeUndefined();
  await maybeInviteToEclipseChannel(42); expect(fake.request).toHaveBeenCalledOnce();
});
