import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ mget: vi.fn(), srem: vi.fn(), get: vi.fn(), expire: vi.fn(), setIfExists: vi.fn(), smembers: vi.fn(), sadd: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock("./redis", () => ({ redis: mocks }));
vi.mock("./realtime", () => ({ triggerRealtimeEvent: vi.fn().mockResolvedValue(undefined), userPrivateChannel: (id: string) => id }));
vi.mock("./eclipse-bot", () => ({ notifyEclipseNewLogin: vi.fn() }));
import { createSession, getSessionFromRequest, listSessionsForUser } from "./session";
describe("session revocation races", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.expire.mockResolvedValue(0); });
  it("does not resurrect a session deleted between GET and its last-seen update", async () => {
    mocks.get.mockResolvedValue(JSON.stringify({ userId: "alice", createdAt: new Date(0).toISOString() }));
    mocks.setIfExists.mockResolvedValue(false);
    const req = new NextRequest("http://localhost/test", { headers: { cookie: "eclipse.sid=revoked" } });
    expect(await getSessionFromRequest(req)).toBeNull();
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("returns a service error instead of accepting stale session data", async () => {
    mocks.get.mockRejectedValue(new Error("offline"));
    const req = new NextRequest("http://localhost/test", { headers: { cookie: "eclipse.sid=session" } });
    await expect(getSessionFromRequest(req)).rejects.toMatchObject({ status: 503 });
  });
  it("does not report real sessions as expired during a store outage", async () => {
    mocks.smembers.mockResolvedValue(["session"]);
    mocks.mget.mockRejectedValue(new Error("offline"));
    await expect(listSessionsForUser("alice")).rejects.toMatchObject({ status: 503 });
  });
  it("does not issue a session that failed registration in the user's session index", async () => {
    mocks.smembers.mockResolvedValue([]); mocks.set.mockResolvedValue("OK");
    mocks.sadd.mockRejectedValue(new Error("offline")); mocks.del.mockResolvedValue(1);
    await expect(createSession("alice")).rejects.toMatchObject({ status: 503 });
    expect(mocks.del).toHaveBeenCalled();
  });
  it("reads 450 devices in three bounded round trips and excludes foreign sessions", async () => {
    mocks.smembers.mockResolvedValue(Array.from({ length: 450 }, (_, i) => `device-${i}`));
    mocks.srem.mockResolvedValue(1);
    mocks.mget.mockImplementation(async (...keys: string[]) => keys.map(key => JSON.stringify({
      userId: key.endsWith("device-0") ? "bob" : "alice", createdAt: new Date(0).toISOString(),
    })));
    const sessions = await listSessionsForUser("alice");
    expect(sessions).toHaveLength(449);
    expect(mocks.mget).toHaveBeenCalledTimes(3);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.srem).toHaveBeenCalledWith("user:sessions:alice", "device-0");
  });
});
