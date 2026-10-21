import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generateKeyPairSync, randomUUID } from "node:crypto";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), find: vi.fn(), claim: vi.fn(), participant: vi.fn(), transaction: vi.fn(), queue: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mocks.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { secretChat: { findUnique: mocks.find }, $transaction: mocks.transaction } }));
vi.mock("@/lib/server/queues/secret-chat-queue", () => ({ secretChatQueue: { add: mocks.queue } }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn().mockResolvedValue(null), userPrivateChannel: (id: string) => id }));
import { POST } from "./route";

const pending = () => ({ id: "chat", isApproved: false, expiresAt: null, lifetimeSeconds: 60, participants: [
  { userId: "alice", acceptedSessionId: "alice-session" }, { userId: "bob", acceptedSessionId: null },
] });
const request = () => new NextRequest("http://localhost/api/chats/secret/accept", { method: "POST", body: JSON.stringify({ secretChatId: "chat" }) });

describe("secret chat acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "bob" }, sessionId: "bob-session" });
    mocks.find.mockResolvedValue(pending());
    mocks.claim.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({ secretChat: { updateMany: mocks.claim }, secretChatParticipant: { update: mocks.participant } }));
  });
  it("commits a durable deadline and binds the session without depending on Redis", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "chat", isApproved: false, expiresAt: null } }));
    expect(mocks.participant).toHaveBeenCalledWith(expect.objectContaining({ data: { acceptedSessionId: "bob-session" } }));
    expect(mocks.queue).not.toHaveBeenCalled();
    expect(mocks.claim.mock.calls[0][0].data.expiresAt).toBeInstanceOf(Date);
  });
  it("rejects replay without resetting the deadline", async () => {
    mocks.find.mockResolvedValue({ ...pending(), isApproved: true, expiresAt: new Date(Date.now() + 60000), participants: [
      { userId: "alice", acceptedSessionId: "alice-session" }, { userId: "bob", acceptedSessionId: "bob-session" },
    ] });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("rejects the losing concurrent acceptance before rebinding a session", async () => {
    mocks.claim.mockResolvedValue({ count: 0 });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.participant).not.toHaveBeenCalled();
  });
  it("does not let the creator approve their own invitation", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "alice" }, sessionId: "alice-session" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not revive an expired chat", async () => {
    mocks.find.mockResolvedValue({ ...pending(), expiresAt: new Date(0) });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires device keys and the observed creator key for v2 approval", async () => {
    const creatorKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const recipientKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const chat = pending();
    mocks.find.mockResolvedValue({ ...chat, cryptoVersion: 2, participants: [
      { ...chat.participants[0], deviceKeyId: randomUUID(), devicePublicKey: creatorKey }, chat.participants[1],
    ] });
    expect((await POST(request())).status).toBe(409);
    const deviceKey = { deviceKeyId: randomUUID(), devicePublicKey: recipientKey };
    const makeRequest = (expectedCreatorPublicKey: string) => new NextRequest("http://localhost/api/chats/secret/accept", { method: "POST", body: JSON.stringify({ secretChatId: "chat", deviceKey, expectedCreatorPublicKey }) });
    expect((await POST(makeRequest("replacement"))).status).toBe(409);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect((await POST(makeRequest(creatorKey))).status).toBe(200);
    expect(mocks.participant).toHaveBeenCalledWith(expect.objectContaining({ data: {
      acceptedSessionId: "bob-session", ...deviceKey,
    } }));
  });
});
