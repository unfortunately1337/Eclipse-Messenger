import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/client/http", () => ({ apiRequest: vi.fn().mockResolvedValue({}) }));
vi.mock("../e2e", () => ({ decryptMessageWithPrivateKeyBase64: vi.fn(), loadStoredE2EKeyPairs: () => [], loadSharedChatKeys: () => [], decryptWithSharedKey: vi.fn() }));
vi.mock("@/lib/i18n/translate", () => ({ translate: (text: string) => text }));
import { handleIncomingMessage } from "./notifications";

function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null };
}
const show = vi.fn(), registration = { showNotification: show };
beforeEach(() => {
  vi.clearAllMocks();
  const notification = { permission: "granted" };
  vi.stubGlobal("window", { Notification: notification, location: { origin: "https://eclpse.ru" } });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("document", { visibilityState: "visible", cookie: "eclipse.locale=ru" });
  vi.stubGlobal("localStorage", storage()); vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) } });
});
afterEach(() => vi.unstubAllGlobals());
const message = { messageId: "one", chatId: "alice", senderId: "sender", senderName: "Alice", senderAvatar: "", text: "hello", createdAt: new Date().toISOString() };
it("suppresses the visible current chat, including differently cased links", async () => {
  await handleIncomingMessage(message, { currentUserId: "reader", getActiveChatId: () => "Alice" });
  expect(show).not.toHaveBeenCalled();
});
it("preserves notifications for a different chat or a hidden app", async () => {
  await handleIncomingMessage(message, { currentUserId: "reader", getActiveChatId: () => "bob" });
  expect(show).toHaveBeenCalledOnce();
  vi.stubGlobal("document", { visibilityState: "hidden", cookie: "eclipse.locale=ru" });
  await handleIncomingMessage({ ...message, messageId: "two" }, { currentUserId: "reader", getActiveChatId: () => "alice" });
  expect(show).toHaveBeenCalledTimes(2);
});
it("also suppresses a chat visible in another fresh tab", async () => {
  localStorage.setItem("msg-notify:tab:other", JSON.stringify({ activeChatId: "ALICE", visibility: "visible", ts: Date.now() }));
  await handleIncomingMessage(message, { currentUserId: "reader", getActiveChatId: () => "bob" });
  expect(show).not.toHaveBeenCalled();
});
it("rechecks the current chat after notification preparation", async () => {
  let active: string | null = null;
  vi.mocked(navigator.serviceWorker.getRegistration).mockImplementation(async () => { active = "alice"; return registration as unknown as ServiceWorkerRegistration; });
  await handleIncomingMessage(message, { currentUserId: "reader", getActiveChatId: () => active });
  expect(show).not.toHaveBeenCalled();
});
