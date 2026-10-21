import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ set: vi.fn(), mget: vi.fn(), values: new Map<string, string>() }));
vi.mock("./redis", () => ({ redis: { set: mock.set, mget: mock.mget } }));
import { grantInteractionPresence, refreshPresence, refreshPresenceSnapshot } from "./presence";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1_800_000_000_000); vi.resetAllMocks(); mock.values.clear();
  mock.set.mockImplementation(async (key, value) => { mock.values.set(key, value); return "OK"; });
  mock.mget.mockImplementation(async (...keys: string[]) => keys.map(key => mock.values.get(key) ?? null));
});
afterEach(() => vi.useRealTimers());
it("does not publish online activity merely by opening or polling the app", async () => {
  mock.values.set("presence:active:v1:subject", "1");
  mock.values.set("presence:last-seen:v1:subject", String(Date.now()));
  await refreshPresence("subject", []);
  expect(await refreshPresence("viewer", ["subject"])).toEqual([]);
  expect(mock.set).not.toHaveBeenCalled();
});
it("grants 30 seconds only to the authorized observers, with no visit timestamps", async () => {
  await grantInteractionPresence("subject", ["viewer", "viewer", "subject", ""]);
  expect(mock.set).toHaveBeenCalledExactlyOnceWith("presence:interaction:v1:viewer:subject", String(Date.now() + 30_000), "EX", 30);
  expect(await refreshPresenceSnapshot("viewer", ["subject", "subject"])).toEqual({
    onlineUserIds: ["subject"], onlineExpiresInMsByUserId: { subject: 30_000 }, lastSeenAtByUserId: {}, hiddenLastSeenUserIds: ["subject"],
  });
  expect(await refreshPresence("unrelated", ["subject"])).toEqual([]);
  expect(await refreshPresence("subject", ["viewer"])).toEqual([]);
  vi.advanceTimersByTime(30_000);
  expect(await refreshPresence("viewer", ["subject"])).toEqual([]);
});
it("refreshes a grant only through another interaction, not a presence poll", async () => {
  await grantInteractionPresence("subject", ["viewer"]); vi.advanceTimersByTime(20_000);
  expect((await refreshPresenceSnapshot("viewer", ["subject"])).onlineExpiresInMsByUserId).toEqual({ subject: 10_000 });
  await grantInteractionPresence("subject", ["viewer"]); vi.advanceTimersByTime(20_000);
  expect(await refreshPresence("viewer", ["subject"])).toEqual(["subject"]);
  vi.advanceTimersByTime(10_000); expect(await refreshPresence("viewer", ["subject"])).toEqual([]);
});
it("ignores malformed and stale grant values and fails closed on storage errors", async () => {
  mock.mget.mockResolvedValueOnce(["1", "garbage", String(Date.now() + 60_000)]);
  expect(await refreshPresence("viewer", ["stale", "invalid", "future"])).toEqual([]);
  mock.mget.mockRejectedValueOnce(new Error("storage offline"));
  await expect(refreshPresence("viewer", ["subject"])).rejects.toThrow();
});
it("a presence storage failure does not fail a persisted message action", async () => {
  mock.set.mockRejectedValueOnce(new Error("storage offline"));
  await expect(grantInteractionPresence("subject", ["viewer"])).resolves.toBeUndefined();
  expect(await refreshPresence("viewer", ["subject"])).toEqual([]);
});
