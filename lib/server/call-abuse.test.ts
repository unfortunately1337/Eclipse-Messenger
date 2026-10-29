import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock("./redis", () => ({ redis: {
  get: async (key: string) => state.store.get(key) ?? null,
  setIfAbsent: async (key: string, value: string) => { if (state.store.has(key)) return false; state.store.set(key, value); return true; },
  compareAndSet: async (key: string, expected: string, value: string) => { if (state.store.get(key) !== expected) return false; state.store.set(key, value); return true; },
} }));
import { assertCallCooldown, recordCallOutcome } from "./call-abuse";
import type { CallRecord } from "./calls";
const call = (id: string, endReason: CallRecord["endReason"], peer = "bob"): CallRecord => ({ id, kind: "direct", mode: "audio", status: "ended", chatId: "chat", link: peer, callerId: "alice", invitedIds: ["alice", peer], parties: {}, createdAt: Date.now() - 45000, startedAt: null, expiresAt: Date.now(), revision: 2, endReason, endedAt: Date.now() });
beforeEach(() => { state.store.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T00:00:00Z")); });
describe("call abuse protection", () => {
  it("blocks only this recipient after two declines and releases after exactly 60 seconds", async () => {
    await recordCallOutcome(call("1", "declined"));
    await expect(assertCallCooldown("alice", "bob")).resolves.toBeUndefined();
    await recordCallOutcome(call("2", "declined"));
    await expect(assertCallCooldown("alice", "bob")).rejects.toMatchObject({ status: 429 });
    await expect(assertCallCooldown("alice", "charlie")).resolves.toBeUndefined();
    vi.advanceTimersByTime(59999);
    await expect(assertCallCooldown("alice", "bob")).rejects.toMatchObject({ status: 429 });
    vi.advanceTimersByTime(1);
    await expect(assertCallCooldown("alice", "bob")).resolves.toBeUndefined();
  });
  it("counts unanswered calls across recipients and blocks the caller for ten minutes", async () => {
    for (let i = 0; i < 4; i++) await recordCallOutcome(call(String(i), "missed", "peer" + i));
    await expect(assertCallCooldown("alice", "new-peer")).resolves.toBeUndefined();
    await recordCallOutcome(call("5", "missed"));
    await expect(assertCallCooldown("alice", "new-peer")).rejects.toMatchObject({ status: 429 });
    await expect(assertCallCooldown("charlie", "bob")).resolves.toBeUndefined();
    vi.advanceTimersByTime(600000);
    await expect(assertCallCooldown("alice", "new-peer")).resolves.toBeUndefined();
  });
  it("concurrent lifecycle retries count the same call once", async () => {
    await Promise.all(Array.from({ length: 12 }, () => recordCallOutcome(call("same", "declined"))));
    await expect(assertCallCooldown("alice", "bob")).resolves.toBeUndefined();
    await recordCallOutcome(call("second", "declined"));
    await expect(assertCallCooldown("alice", "bob")).rejects.toMatchObject({ status: 429 });
  });
  it("cancelled calls do not count, and a completed call resets unanswered/declined streaks", async () => {
    for (let i = 0; i < 4; i++) await recordCallOutcome(call(String(i), "missed"));
    await recordCallOutcome(call("d", "declined"));
    await recordCallOutcome(call("ok", "completed"));
    await recordCallOutcome(call("cancel", "cancelled"));
    await recordCallOutcome(call("next", "declined"));
    await recordCallOutcome(call("miss", "missed"));
    await expect(assertCallCooldown("alice", "bob")).resolves.toBeUndefined();
  });
});
