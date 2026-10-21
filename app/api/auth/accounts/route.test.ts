import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ primary: vi.fn(), secondary: vi.fn(), user: vi.fn(), counts: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ getSessionFromRequest: mock.primary, getSecondarySessionFromRequest: mock.secondary, clearSecondarySessionCookie: mock.clear }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findUnique: mock.user } } }));
vi.mock("@/lib/server/account-unread", () => ({ getAccountUnreadCounts: mock.counts }));
vi.mock("@/lib/server/csrf", () => ({ ensureCsrfCookie: vi.fn() }));
import { GET } from "./route";
const req = () => new NextRequest("http://localhost/api/auth/accounts?userId=foreign");
beforeEach(() => {
  vi.resetAllMocks();
  mock.primary.mockResolvedValue({ sessionId: "s1", data: { userId: "one" } });
  mock.secondary.mockResolvedValue({ sessionId: "s2", data: { userId: "two" } });
  mock.user.mockImplementation(async ({ where }) => ({ id: where.id, displayName: where.id, link: where.id, avatarUrl: null }));
  mock.counts.mockResolvedValue(new Map([["one", 14], ["two", 10000]]));
});
it("only counts authenticated account sessions and prevents response caching", async () => {
  const response = await GET(req());
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mock.counts).toHaveBeenCalledWith([{ userId: "one", sessionId: "s1" }, { userId: "two", sessionId: "s2" }]);
  expect((await response.json()).data.accounts.map((a: { unreadCount: number }) => a.unreadCount)).toEqual([14, 10000]);
});
it("does not query private unread counts without a primary session", async () => {
  mock.primary.mockResolvedValue(null);
  expect((await (await GET(req())).json()).data.accounts).toEqual([]);
  expect(mock.counts).not.toHaveBeenCalled();
});
it("clears a duplicate secondary session without double counting", async () => {
  mock.secondary.mockResolvedValue({ sessionId: "s2", data: { userId: "one" } });
  expect((await (await GET(req())).json()).data.accounts).toHaveLength(1);
  expect(mock.counts).toHaveBeenCalledWith([{ userId: "one", sessionId: "s1" }]);
  expect(mock.clear).toHaveBeenCalledOnce();
});
