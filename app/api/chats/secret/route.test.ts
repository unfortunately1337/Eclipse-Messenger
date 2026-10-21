import { generateKeyPairSync, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ create: vi.fn(), transaction: vi.fn(), count: vi.fn(), contact: vi.fn(), existing: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: vi.fn().mockResolvedValue({ user: { id: "alice", link: "alice", displayName: "Alice" }, sessionId: "alice-session" }) }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/server/privacy-settings", () => ({ getPrivacySettings: vi.fn(), canUserStartConversation: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn(), userPrivateChannel: (id: string) => id }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { count: mocks.count }, contact: { findUnique: mocks.contact }, secretChat: { findFirst: mocks.existing }, $transaction: mocks.transaction } }));
import { POST, GET } from "./route";

describe("new secret chat encryption protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockImplementation(({ where }: { where: { isBot?: boolean } }) => Promise.resolve(where.isBot ? 0 : 2));
    mocks.contact.mockResolvedValue(null);
    mocks.existing.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "chat", title: "Secret", lifetimeSeconds: 60, isApproved: false, participants: [
      { userId: "alice", user: { id: "alice", displayName: "Alice" } }, { userId: "bob", user: { id: "bob", displayName: "Bob" } },
    ] });
    mocks.transaction.mockImplementation(callback => callback({ $executeRaw: mocks.lock, secretChat: { create: mocks.create, findFirst: mocks.existing } }));
  });
  const request = (extra = {}) => new NextRequest("http://localhost/api/chats/secret", { method: "POST", body: JSON.stringify({ participantUserIds: ["bob"], lifetimeSeconds: 60, ...extra }) });
  it("does not silently create a new account-key chat from an old client", async () => {
    expect((await POST(request())).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects bots before creating a secret chat", async () => {
    mocks.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    const deviceKeyId = randomUUID();
    const devicePublicKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    expect((await POST(request({ deviceKeyId, devicePublicKey }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("registers only the creator device's public key and session", async () => {
    const deviceKeyId = randomUUID();
    const devicePublicKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    expect((await POST(request({ deviceKeyId, devicePublicKey }))).status).toBe(200);
    expect(mocks.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ cryptoVersion: 2, participants: { create: [
      { userId: "alice", acceptedSessionId: "alice-session", deviceKeyId, devicePublicKey },
      { userId: "bob", acceptedSessionId: null, deviceKeyId: null, devicePublicKey: null },
    ] } }));
  });
  it("rejects duplicate creation after locking the pair", async () => {
    mocks.existing.mockResolvedValue({ id: "existing" });
    const deviceKeyId = randomUUID();
    const devicePublicKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const response = await POST(request({ deviceKeyId, devicePublicKey }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("У вас уже есть активный секретный чат с этим пользователем");
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("checks only the authenticated user's exact pair without returning chat data", async () => {
    mocks.existing.mockResolvedValue({ id: "existing" });
    const response = await GET(new NextRequest("http://localhost/api/chats/secret?peerId=bob"));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ exists: true });
    expect(mocks.existing.mock.calls[0][0].where).toEqual(expect.objectContaining({
      AND: [{ participants: { some: { userId: "alice" } } }, { participants: { some: { userId: "bob" } } }],
      participants: { every: { userId: { in: ["alice", "bob"] } } },
      OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
    }));
  });

});
