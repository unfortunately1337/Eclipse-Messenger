import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), reconcile: vi.fn(), access: vi.fn(), caller: vi.fn(), contact: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mocks.auth }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/server/calls", () => ({ reconcileCall: mocks.reconcile, assertCallAccess: mocks.access }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findUnique: mocks.caller }, contact: { findUnique: mocks.contact } } }));
import { GET } from "./route";
import { HttpError } from "@/lib/server/http";
const id = "00000000-0000-4000-8000-000000000001";
const get = () => GET(new NextRequest(`https://example.com/api/calls/notification?id=${id}`));
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); mocks.auth.mockResolvedValue({ user: { id: "bob" }, sessionId: "session" }); mocks.reconcile.mockResolvedValue({ id, kind: "direct", callerId: "alice", status: "ringing", parties: { alice: { sessionId: "secret-session" } } }); mocks.caller.mockResolvedValue({ displayName: "Alice", link: "alice" }); mocks.contact.mockResolvedValue(null); });
it("authenticates push metadata requests and never exposes call credentials", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const body = await response.json();
  expect(body.data).toMatchObject({ recipientId: "bob", state: "ringing", senderName: "Alice" });
  expect(JSON.stringify(body)).not.toMatch(/session|token|secret/);
  mocks.auth.mockRejectedValueOnce(new HttpError(401, "auth"));
  expect((await get()).status).toBe(401);
});
it("refuses nonparticipants and never calls a stale accepted call ringing", async () => {
  mocks.access.mockRejectedValueOnce(new HttpError(403, "denied"));
  expect((await get()).status).toBe(403);
  mocks.reconcile.mockResolvedValueOnce({ id, kind: "direct", callerId: "alice", status: "active" });
  expect((await (await get()).json()).data.state).toBe("closed");
});
