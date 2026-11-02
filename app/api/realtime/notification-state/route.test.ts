import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), csrf: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mocks.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: mocks.csrf, ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/server/notification-view", () => ({ setNotificationView: mocks.set }));
import { POST } from "./route";
const tabId = "00000000-0000-4000-8000-000000000001";
const request = (userId = "reader", chatId: string | null = "alice") => new NextRequest("http://localhost/api/realtime/notification-state", { method: "POST", body: JSON.stringify({ userId, tabId, chatId }) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "reader" }, sessionId: "authenticated-session" }); });
it("binds the private view to the authenticated account and session", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.set).toHaveBeenCalledWith("reader", "authenticated-session", tabId, "alice");
  expect((await POST(request("reader", null))).status).toBe(200);
  expect(mocks.set).toHaveBeenLastCalledWith("reader", "authenticated-session", tabId, null);
});
it("rejects a late heartbeat from a different account", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await POST(request("other"))).status).toBe(409);
  expect(mocks.set).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
it("requires CSRF and authentication before storing delivery state", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.csrf.mockImplementation(() => { throw new Error("invalid csrf"); });
  await POST(request()); expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
