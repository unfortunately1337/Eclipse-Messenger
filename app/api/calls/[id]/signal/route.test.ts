import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HttpError } from "@/lib/server/http";
const mock = vi.hoisted(() => ({ auth: vi.fn(), csrf: vi.fn(), limit: vi.fn(), access: vi.fn(), read: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mock.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: mock.csrf }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mock.limit }));
vi.mock("@/lib/server/calls", () => ({ sessionCallForActor: mock.access }));
vi.mock("@/lib/server/call-p2p", () => ({ readP2PSignals: mock.read, sendP2PSignal: mock.send }));
import { GET, POST } from "./route";
const id = "00000000-0000-4000-8000-000000000001", clientId = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ id }) };
const event = () => ({ id, clientId, epoch: id, payload: { type: "ready" } });
const post = (body: unknown) => POST(new NextRequest(`https://example.com/api/calls/${id}/signal`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), context);
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {});
  mock.auth.mockResolvedValue({ user: { id: "alice" }, sessionId: "session-a" });
  mock.access.mockResolvedValue({ id }); mock.read.mockResolvedValue({ messages: [], cursor: 0, reset: false });
});
it("checks authentication and CSRF before publishing any signaling", async () => {
  mock.csrf.mockImplementationOnce(() => { throw new HttpError(403, "CSRF rejected"); });
  expect((await post(event())).status).toBe(403); expect(mock.send).not.toHaveBeenCalled();
  mock.auth.mockRejectedValueOnce(new HttpError(401, "Unauthenticated"));
  expect((await post(event())).status).toBe(401); expect(mock.send).not.toHaveBeenCalled();
});
it("rejects spoofed senders, unsupported SDP types and oversized signaling", async () => {
  expect((await post({ ...event(), fromUserId: "victim" })).status).toBe(400);
  expect((await post({ ...event(), payload: { type: "description", negotiationId: id, description: { type: "rollback", sdp: "v=0" } } })).status).toBe(400);
  expect((await post({ ...event(), payload: { type: "description", negotiationId: id, description: { type: "offer", sdp: "x".repeat(100_000) } } })).status).toBe(413);
  expect(mock.send).not.toHaveBeenCalled();
});
it("uses the authenticated session and prevents access to an unaccepted or foreign call", async () => {
  mock.access.mockRejectedValueOnce(new HttpError(403, "Forbidden"));
  expect((await post(event())).status).toBe(403); expect(mock.send).not.toHaveBeenCalled();
  expect((await post(event())).status).toBe(200);
  expect(mock.access).toHaveBeenCalledWith({ userId: "alice", sessionId: "session-a" }, id);
  expect(mock.send).toHaveBeenCalledWith({ id }, { userId: "alice", sessionId: "session-a" }, event(), expect.any(Function));
});
it("bounds polling cursors, rate-limits the session and never caches an inbox", async () => {
  const url = `https://example.com/api/calls/${id}/signal?clientId=${clientId}`;
  expect((await GET(new NextRequest(url + "&after=-1"), context)).status).toBe(400);
  const response = await GET(new NextRequest(url + "&after=12"), context);
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mock.limit).toHaveBeenCalledWith(expect.objectContaining({ key: "calls:p2p:read:session-a", limit: 240 }));
  expect(mock.read).toHaveBeenCalledWith({ id }, { userId: "alice", sessionId: "session-a" }, clientId, 12);
});
