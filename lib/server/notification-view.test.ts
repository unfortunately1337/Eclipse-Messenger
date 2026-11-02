import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ values: new Map<string, string>(), indexes: new Map<string, Set<string>>(), set: vi.fn() }));
vi.mock("./redis", () => ({ redis: {
  set: mock.set,
  get: async (key: string) => mock.values.get(key) ?? null,
  mget: async (...keys: string[]) => keys.map(key => mock.values.get(key) ?? null),
  del: async (key: string) => Number(mock.values.delete(key)),
  expire: vi.fn(),
  sadd: async (key: string, value: string) => { const set = mock.indexes.get(key) ?? new Set(); set.add(value); mock.indexes.set(key, set); },
  smembers: async (key: string) => [...(mock.indexes.get(key) ?? [])],
  srem: async (key: string, ...values: string[]) => { for (const value of values) mock.indexes.get(key)?.delete(value); },
} }));
import { setNotificationView, isNotificationChatVisible } from "./notification-view";
beforeEach(() => {
  mock.values.clear(); mock.indexes.clear(); vi.clearAllMocks();
  mock.set.mockImplementation(async (key: string, value: string) => { mock.values.set(key, value); });
});
it("suppresses only the chat being read by the recipient, across devices", async () => {
  await setNotificationView("reader", "session", "tab", " Alice ");
  expect(await isNotificationChatVisible("reader", "alice")).toBe(true);
  expect(await isNotificationChatVisible("reader", "bob")).toBe(false);
  expect(await isNotificationChatVisible("someone-else", "alice")).toBe(false);
  expect(mock.set.mock.calls[0].slice(2)).toEqual(["EX", 20]);
});
it("switching chats, hiding a tab and closing it immediately release its old view", async () => {
  await setNotificationView("reader", "session", "tab", "alice");
  await setNotificationView("reader", "session", "tab", "bob");
  expect(await isNotificationChatVisible("reader", "alice")).toBe(false);
  expect(await isNotificationChatVisible("reader", "bob")).toBe(true);
  await setNotificationView("reader", "session", "tab", null);
  expect(await isNotificationChatVisible("reader", "bob")).toBe(false);
});
it("closing one tab preserves a view still open in another session", async () => {
  await setNotificationView("reader", "one", "tab", "alice");
  await setNotificationView("reader", "two", "tab", "alice");
  await setNotificationView("reader", "one", "tab", null);
  expect(await isNotificationChatVisible("reader", "alice")).toBe(true);
});
it("expired heartbeats no longer suppress notifications and are removed from the index", async () => {
  await setNotificationView("reader", "one", "tab", "alice");
  mock.values.clear();
  expect(await isNotificationChatVisible("reader", "alice")).toBe(false);
  expect([...mock.indexes.values()][0].size).toBe(0);
});
