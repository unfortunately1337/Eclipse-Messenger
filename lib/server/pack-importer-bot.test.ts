import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ owned: vi.fn(), messages: vi.fn(), findMessage: vi.fn(), jobs: vi.fn(), updateCard: vi.fn(), user: vi.fn(), state: vi.fn(), inspect: vi.fn(), added: 0 }));
vi.mock("argon2", () => ({ default: { hash: vi.fn() } }));
vi.mock("./chat", () => ({ getOrCreateDirectConversation: async () => "conversation" }));
vi.mock("./db-crypto", () => ({ encryptAtRest: (value: string) => value }));
vi.mock("./bot-messaging", () => ({ readBotContent: vi.fn(), notifyBotChat: vi.fn() }));
vi.mock("./auth", () => ({ requireUserFromRequest: async () => ({ user: { id: "viewer" } }) }));
vi.mock("./csrf", () => ({ verifyCsrf: vi.fn() }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("./telegram-pack-import", () => ({ inspectTelegramPack: fake.inspect, preparePackImport: async (packId: string, userId: string) => {
  const installed = Boolean(await fake.owned({ where: { userId_packId: { userId, packId } } }));
  return { installed, added: fake.added, source: { title: "Ducks" }, snapshot: { update: installed }, card: { packId, title: "Ducks", kind: "sticker", count: installed ? fake.added : 12, packCount: 12 + fake.added, update: installed, status: "confirm", completed: 0 } };
} }));
vi.mock("./prisma", () => {
  const db = { userImportedPack: { findUnique: fake.owned }, user: { findUnique: fake.user }, packImporterState: { findUnique: fake.state },
    message: { upsert: fake.messages, findFirst: fake.findMessage, findUnique: fake.findMessage, update: fake.updateCard },
    conversation: { update: vi.fn() }, $executeRaw: vi.fn(), packImportJob: { findUnique: fake.jobs, create: fake.jobs } };
  return { prisma: { ...db, $transaction: (callback: (value: typeof db) => unknown) => callback(db) } };
});
import { handleImporterCallback, handleImporterMessage, importerUi, offerImporterPack } from "./pack-importer-bot";
const pack = { id: "pack-test", title: "Ducks", kind: "sticker", count: 12 };
beforeEach(() => {
  vi.resetAllMocks();
  fake.added = 0;
  fake.messages.mockImplementation(async ({ create }) => ({ ...create, createdAt: new Date() }));
  fake.user.mockResolvedValue({ id: "system:importbot" });
});
it("responds with the owned pack's name instead of another import card", async () => {
  fake.owned.mockResolvedValue({ userId: "viewer", packId: pack.id });
  expect(await offerImporterPack("viewer", "conversation", pack, "reply")).toBe(false);
  const payload = fake.messages.mock.lastCall![0].create.systemPayload;
  expect(payload.body).toBe("В вашем аккаунте уже есть набор «Ducks». Новых элементов нет.");
  expect(payload.metadata.packImport).toBeUndefined();
});
it("offers an incremental update instead of rejecting an owned pack when Telegram has additions", async () => {
  fake.owned.mockResolvedValue({}); fake.added = 10;
  expect(await offerImporterPack("viewer", "conversation", pack, "update-reply")).toBe(true);
  expect(fake.messages.mock.lastCall![0].create.systemPayload.metadata.packImport).toMatchObject({ update: true, count: 10, packCount: 22 });
});
it("checks ownership for the requesting account, allowing other users to import the same pack", async () => {
  fake.owned.mockResolvedValue(null);
  expect(await offerImporterPack("other-user", "conversation", pack, "reply")).toBe(true);
  expect(fake.owned).toHaveBeenCalledWith({ where: { userId_packId: { userId: "other-user", packId: pack.id } } });
  expect(fake.messages.mock.lastCall![0].create.systemPayload.metadata.packImport.status).toBe("confirm");
});
it("rechecks ownership on an old confirmation button and never queues another job", async () => {
  const card = { packId: pack.id, title: pack.title, kind: "sticker", count: 12, completed: 0, status: "confirm" };
  fake.findMessage.mockResolvedValue({ id: "message", conversationId: "conversation", systemPayload: { metadata: { packImport: card } } });
  fake.owned.mockResolvedValue({ userId: "viewer" });
  const request = new NextRequest("http://localhost/api/bots/importbot/callback", { method: "POST", body: JSON.stringify({ messageId: "message", data: "import", requestId: crypto.randomUUID() }) });
  const response = await handleImporterCallback(request);
  expect((await response.json()).data.alreadyInstalled).toBe(true);
  expect(fake.jobs).not.toHaveBeenCalled();
  expect(fake.updateCard.mock.lastCall![0].data.systemPayload.metadata.packImport.status).toBe("ready");
});
it("publishes the importer intro and a dedicated Help menu action", async () => {
  const ui = await importerUi("viewer");
  expect(ui.settings.empty_text).toContain("Что умеет этот бот?");
  expect(ui.settings.empty_text).toContain("/help");
  expect(ui.settings.menu.keyboard.flat()).toContainEqual({ text: "Помощь", message: "/help" });
  expect(ui.settings.menu.keyboard.flat().map(button => button.message)).toEqual(["/telegram", "/help"]);
});
it("detects the link type automatically even if an obsolete emoji-only mode was selected before", async () => {
  fake.state.mockResolvedValue({ kind: "emoji" }); fake.inspect.mockResolvedValue(pack);
  const text = "https://t.me/addstickers/Ducks";
  const request = new NextRequest("http://localhost/api/bots/importbot/messages", { method: "POST", body: JSON.stringify({ text, requestId: crypto.randomUUID() }) });
  expect((await handleImporterMessage(request)).status).toBe(200);
  expect(fake.inspect).toHaveBeenCalledExactlyOnceWith(text); expect(fake.state).not.toHaveBeenCalled();
});
