import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ auth: vi.fn(), csrf: vi.fn(), limit: vi.fn(), enabled: vi.fn(), own: vi.fn(), group: vi.fn(), view: vi.fn(), start: vi.fn(), join: vi.fn(), token: vi.fn(), heartbeat: vi.fn(), leave: vi.fn(), audio: vi.fn(), ended: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mock.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: mock.csrf, ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mock.limit }));
vi.mock("@/lib/server/livekit", () => ({ livekitConfigured: mock.enabled }));
vi.mock("@/lib/server/calls", () => ({ ownCall: mock.own, groupCall: mock.group, callView: mock.view, startCall: mock.start, joinCall: mock.join, connectionForCall: mock.token, heartbeatCall: mock.heartbeat, leaveCall: mock.leave, saveCallParticipantAudio: mock.audio, endedCallOutcome: mock.ended }));
import { GET, POST } from "./route";
import { HttpError } from "@/lib/server/http";

const id = "00000000-0000-4000-8000-000000000001";
const post = (data: unknown) => POST(new NextRequest("https://example.com/api/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mock.auth.mockResolvedValue({ user: { id: "alice" }, sessionId: "alice-session" });
  mock.enabled.mockReturnValue(true);
  mock.own.mockResolvedValue(null);
  mock.group.mockResolvedValue(null);
  mock.start.mockResolvedValue({ id });
  mock.view.mockResolvedValue({ id, status: "ringing" });
});

it("never creates calls for an unauthenticated or CSRF-rejected request", async () => {
  mock.csrf.mockImplementationOnce(() => { throw new HttpError(403, "CSRF rejected"); });
  expect((await post({ action: "start", kind: "direct", mode: "audio", link: "bob" })).status).toBe(403);
  expect(mock.start).not.toHaveBeenCalled();
  mock.auth.mockRejectedValueOnce(new HttpError(401, "Authentication required"));
  expect((await post({ action: "start", kind: "direct", mode: "audio", link: "bob" })).status).toBe(401);
  expect(mock.start).not.toHaveBeenCalled();
});

it("rejects caller-supplied identity, session, room and privilege fields", async () => {
  for (const extra of [{ userId: "victim" }, { sessionId: "stolen" }, { room: "other-room" }, { roomAdmin: true }]) {
    expect((await post({ action: "token", id, ...extra })).status).toBe(400);
  }
  expect(mock.token).not.toHaveBeenCalled();
});

it("passes only the authenticated actor to call creation and returns no-store responses", async () => {
  const response = await post({ action: "start", kind: "group", mode: "audio", link: "testgroup" });
  expect(response.status).toBe(200);
  expect(mock.start).toHaveBeenCalledWith({ userId: "alice", sessionId: "alice-session" }, "group", "audio", "testgroup");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mock.limit).toHaveBeenCalledWith(expect.objectContaining({ key: "calls:start:alice", limit: 5 }));
});

it("rejects oversized bodies and unsupported call types", async () => {
  expect((await post({ action: "start", kind: "channel", mode: "audio", link: "news" })).status).toBe(400);
  expect((await post({ action: "start", kind: "direct", mode: "audio", link: "a".repeat(3000) })).status).toBe(413);
  expect(mock.start).not.toHaveBeenCalled();
});

it("hides unavailable integration and requires authentication for polling", async () => {
  mock.enabled.mockReturnValue(false);
  const response = await GET(new NextRequest("https://example.com/api/calls"));
  expect((await response.json()).data).toEqual({ enabled: false, current: null, groupCall: null });
  expect(mock.own).not.toHaveBeenCalled();
  mock.auth.mockRejectedValueOnce(new HttpError(401, "Authentication required"));
  expect((await GET(new NextRequest("https://example.com/api/calls"))).status).toBe(401);
});

it("validates and isolates session audio settings", async () => {
  expect((await post({ action: "participant-audio", id, peerId: "bob", volume: 0.5, muted: false })).status).toBe(200);
  expect(mock.audio).toHaveBeenCalledWith({ userId: "alice", sessionId: "alice-session" }, id, "bob", { volume: 0.5, muted: false });
  for (const extra of [{ volume: 2 }, { volume: -1 }, { sessionId: "stolen" }, { muted: "false" }]) {
    expect((await post({ action: "participant-audio", id, peerId: "bob", volume: 0.5, muted: false, ...extra })).status).toBe(400);
  }
});

it("returns only the authorized previous call's terminal outcome", async () => {
  mock.ended.mockResolvedValue({ id, outcome: "declined" });
  const response = await GET(new NextRequest("https://example.com/api/calls?previous=" + id));
  expect((await response.json()).data.ended).toEqual({ id, outcome: "declined" });
  expect(mock.ended).toHaveBeenCalledWith({ userId: "alice", sessionId: "alice-session" }, id);
  mock.ended.mockRejectedValueOnce(new HttpError(403, "Forbidden"));
  expect((await (await GET(new NextRequest("https://example.com/api/calls?previous=" + id))).json()).data.ended).toBeNull();
});
