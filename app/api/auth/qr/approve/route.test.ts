import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ require: vi.fn(), restriction: vi.fn(), get: vi.fn(), cas: vi.fn(), create: vi.fn(), destroy: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: fake.require }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ assertSessionCanUseSensitiveSettings: fake.restriction, createSession: fake.create, destroySessionById: fake.destroy }));
vi.mock("@/lib/server/redis", () => ({ redis: { get: fake.get, compareAndSet: fake.cas } }));
import { POST } from "./route";
const request = () => POST(new NextRequest("https://eclpse.ru/api/auth/qr/approve", { method: "POST", body: JSON.stringify({ qrToken: "019cf080-62ce-7000-8000-000000000001" }) }));
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {});
  fake.require.mockResolvedValue({ user: { id: "alice" }, sessionData: { createdAt: new Date().toISOString() } });
});
afterEach(() => vi.restoreAllMocks());
it("does not let a restricted new session authorize another device", async () => {
  fake.restriction.mockImplementation(() => { throw { status: 403, message: "Restricted session" }; });
  expect((await request()).status).toBe(403);
  expect(fake.get).not.toHaveBeenCalled(); expect(fake.cas).not.toHaveBeenCalled(); expect(fake.create).not.toHaveBeenCalled();
});
it("preserves QR login from a trusted session and checks restrictions before claiming the token", async () => {
  fake.get.mockResolvedValue(JSON.stringify({ status: "pending", ownerHash: "owner-proof" }));
  fake.cas.mockResolvedValue(true); fake.create.mockResolvedValue("new-device");
  expect((await request()).status).toBe(200);
  expect(fake.restriction.mock.invocationCallOrder[0]).toBeLessThan(fake.get.mock.invocationCallOrder[0]);
  expect(fake.create).toHaveBeenCalledWith("alice", expect.any(Object));
});
