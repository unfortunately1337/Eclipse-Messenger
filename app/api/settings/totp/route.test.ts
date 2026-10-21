import { NextRequest } from "next/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ confirm: vi.fn(), rate: vi.fn(), find: vi.fn(), update: vi.fn(), pending: vi.fn(), consume: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: vi.fn(async () => ({ user: { id: "user" }, sessionId: "device", sessionData: {} })) }));
vi.mock("@/lib/server/session", () => ({ assertSessionCanUseSensitiveSettings: vi.fn() }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findUnique: mock.find, updateMany: mock.update } } }));
vi.mock("@/lib/server/password-confirmation", () => ({ requireConfirmedSessionPassword: mock.confirm }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mock.rate }));
vi.mock("@/lib/server/password-check", () => ({ verifyCurrentPassword: vi.fn() }));
vi.mock("@/lib/server/mfa", () => ({ getPendingTotpSecret: mock.pending, consumePendingTotpSecret: mock.consume, setPendingTotpSecret: vi.fn() }));
vi.mock("@/lib/server/totp", () => ({ verifyTotpToken: mock.verify, encryptTotpSecret: (s: string) => s, decryptTotpSecret: vi.fn(), generateTotpSecret: vi.fn(), getTotpQrDataUrl: vi.fn(), getTotpUri: vi.fn() }));
vi.mock("@/lib/server/eclipse-bot", () => ({ notifyEclipseTwoFactorEnabled: vi.fn(async () => {}), notifyEclipseTwoFactorDisabled: vi.fn(async () => {}) }));
import { PATCH, POST } from "./route";
const send = () => POST(new NextRequest("http://localhost/api/settings/totp", { method: "POST", body: JSON.stringify({ code: "123456" }) }));
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); mock.confirm.mockResolvedValue("confirmed-hash"); mock.find.mockResolvedValue({ twoFactorEnabled: false }); mock.pending.mockResolvedValue("pending-secret"); mock.update.mockResolvedValue({ count: 1 }); });
afterEach(() => vi.restoreAllMocks());
it("leaves the pending QR secret intact after an incorrect code", async () => {
  mock.verify.mockReturnValue(false); expect((await send()).status).toBe(401);
  expect(mock.consume).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
});
it("enables 2FA only after verifying and atomically claiming the same secret", async () => {
  mock.verify.mockReturnValue(true); mock.consume.mockResolvedValue("pending-secret");
  expect((await send()).status).toBe(200);
  expect(mock.consume).toHaveBeenCalledWith("user", "pending-secret", "device");
  expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user", twoFactorEnabled: false, passwordHash: "confirmed-hash" } }));
});
it("blocks both QR generation and enabling when the session has not confirmed its password", async () => {
  mock.confirm.mockRejectedValue({ status: 403, message: "Password confirmation required" });
  expect((await PATCH(new NextRequest("http://localhost/api/settings/totp", { method: "PATCH" }))).status).toBe(403);
  expect((await send()).status).toBe(403);
  expect(mock.pending).not.toHaveBeenCalled(); expect(mock.find).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
});
it("never overwrites a secret that another device has already enabled", async () => {
  mock.verify.mockReturnValue(true); mock.consume.mockResolvedValue("pending-secret"); mock.update.mockResolvedValue({ count: 0 });
  expect((await send()).status).toBe(409);
});
it("does not enable 2FA using a secret replaced in another tab", async () => {
  mock.verify.mockReturnValue(true); mock.consume.mockResolvedValue(null);
  expect((await send()).status).toBe(409); expect(mock.update).not.toHaveBeenCalled();
});
it("rejects repeated guessing before token verification", async () => {
  mock.rate.mockRejectedValue({ status: 429, message: "Rate limited" });
  expect((await send()).status).toBe(429); expect(mock.verify).not.toHaveBeenCalled();
});
