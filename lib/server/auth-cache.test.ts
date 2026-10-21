import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ find: vi.fn(), session: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { user: { findUnique: mock.find } } }));
vi.mock("./session", () => ({ getSessionFromCookies: mock.session, getSessionFromRequest: mock.session }));
import { getCurrentUser, invalidateUserCache } from "./auth";
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); invalidateUserCache("user"); mock.session.mockResolvedValue({ data: { userId: "user" } }); });
afterEach(() => vi.useRealTimers());
it("never authorizes from expired user data during a database outage", async () => {
  mock.find.mockResolvedValueOnce({ id: "user" });
  expect(await getCurrentUser()).toEqual({ id: "user" });
  vi.advanceTimersByTime(15_001); mock.find.mockRejectedValue(new Error("database unavailable"));
  await expect(getCurrentUser()).rejects.toThrow("database unavailable");
});
it("does not resurrect a deleted user from the short-lived cache after expiry", async () => {
  mock.find.mockResolvedValueOnce({ id: "user" }).mockResolvedValueOnce(null);
  await getCurrentUser(); vi.advanceTimersByTime(15_001);
  expect(await getCurrentUser()).toBeNull();
});
