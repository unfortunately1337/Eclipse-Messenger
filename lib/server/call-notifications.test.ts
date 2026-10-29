import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ store: new Map<string, string>(), publish: vi.fn() }));
vi.mock("./redis", () => ({ redis: {
  get: async (key: string) => mocks.store.get(key) ?? null,
  set: async (key: string, value: string) => { mocks.store.set(key, value); return "OK"; },
  setIfAbsent: async (key: string, token: string) => { if (mocks.store.has(key)) return false; mocks.store.set(key, token); return true; },
  compareAndDelete: async (key: string, token: string) => { if (mocks.store.get(key) === token) return mocks.store.delete(key); return false; },
} }));
vi.mock("./beams", () => ({ publishBeamsCallToUser: mocks.publish }));
import { deliverCallNotification } from "./call-notifications";
import type { CallRecord } from "./calls";
const call = (): CallRecord => ({ id: "id", kind: "direct", mode: "audio", status: "ringing", chatId: "chat", link: "bob", callerId: "alice", invitedIds: ["alice", "bob"], parties: {}, createdAt: Date.now(), startedAt: null, expiresAt: Date.now() + 45000, revision: 1 });
beforeEach(() => { vi.resetAllMocks(); mocks.store.clear(); });
it("deduplicates concurrent push attempts by call and sends only to the callee", async () => {
  await Promise.all(Array.from({ length: 8 }, () => deliverCallNotification(call())));
  expect(mocks.publish).toHaveBeenCalledTimes(1);
  expect(mocks.publish).toHaveBeenCalledWith("bob", expect.objectContaining({ callId: "id", state: "ringing" }));
  expect(JSON.stringify(mocks.publish.mock.calls)).not.toMatch(/session|token|secret|Alice|friend|chat=/);
});
it("retries a failed publish, updates the same call for missed state, ignores expired ringing", async () => {
  mocks.publish.mockRejectedValueOnce(new Error("offline"));
  await expect(deliverCallNotification(call())).rejects.toThrow("offline");
  await deliverCallNotification(call());
  await deliverCallNotification({ ...call(), status: "ended", endReason: "missed" });
  await deliverCallNotification({ ...call(), createdAt: Date.now() - 46000 });
  expect(mocks.publish).toHaveBeenCalledTimes(3);
  expect(mocks.publish).toHaveBeenLastCalledWith("bob", expect.objectContaining({ callId: "id", state: "missed" }));
});
