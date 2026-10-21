import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), existing: vi.fn(), transaction: vi.fn(), latest: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn(), lock: vi.fn(), history: vi.fn(), memberKey: vi.fn(), holders: vi.fn(),
}));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: vi.fn().mockResolvedValue({ user: { id: "alice" } }) }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/e2e-storage", () => ({ encryptE2ESecretForDb: (v: string) => v, decryptE2ESecretFromDb: (v: string) => v }));
vi.mock("@/lib/server/e2e-key", () => ({ getUserPublicKeys: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("@/lib/server/shared-key-notifications", () => ({ notifySharedKeysReady: vi.fn(), requestSharedHistoryKeys: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  $queryRaw: mocks.query, $transaction: mocks.transaction,
  groupE2EKey: { findFirst: mocks.existing, findMany: mocks.history }, channelE2EKey: { findFirst: mocks.existing, findMany: mocks.history },
  groupE2EKeyMember: { findFirst: mocks.memberKey, findMany: mocks.holders }, channelE2EKeyMember: { findFirst: mocks.memberKey, findMany: mocks.holders },
} }));
import { GET as groupGet, POST as groupPost } from "@/app/api/groups/[link]/e2e-key/route";
import { GET as channelGet, POST as channelPost } from "@/app/api/channels/[link]/e2e-key/route";

const request = (version: number) => new NextRequest("http://localhost/api/keys", {
  method: "POST", body: JSON.stringify({ version, keys: [{ userId: "alice", encryptedKey: Buffer.alloc(256).toString("base64") }] }),
});

describe.each([groupGet, channelGet])("shared history discovery", get => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue([{ id: "community", link: "community", ownerId: "alice", myRole: "owner", isSubscribed: true, userId: "alice" }]);
    mocks.existing.mockResolvedValue({ id: "key", version: 2 });
    mocks.memberKey.mockResolvedValue({ encryptedKey: "own envelope" });
    mocks.holders.mockResolvedValue([{ userId: "alice" }]);
    mocks.history.mockResolvedValue([{ version: 2, members: [{ userId: "alice" }] }, { version: 1, members: [{ userId: "alice" }, { userId: "bob" }] }]);
  });
  it("lets the owner discover missing holders for every epoch without exposing key material", async () => {
    const response = await get(new NextRequest("http://localhost/api/keys?includeMembers=1"), params());
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.keyHistory).toEqual([{ version: 2, keyHolders: ["alice"] }, { version: 1, keyHolders: ["alice", "bob"] }]);
    expect(data.encryptedKey).toBe("own envelope");
  });
  it("does not expose epoch discovery to an ordinary member", async () => {
    mocks.query.mockResolvedValue([{ id: "community", link: "community", ownerId: "bob", myRole: "member", isSubscribed: true }]);
    const response = await get(new NextRequest("http://localhost/api/keys?includeMembers=1"), params());
    expect(response.status).toBe(200);
    expect((await response.json()).data.keyHistory).toBeUndefined();
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("denies outsiders before loading any historical key", async () => {
    mocks.query.mockResolvedValue([]);
    expect([403, 404]).toContain((await get(new NextRequest("http://localhost/api/keys?version=1&includeMembers=1"), params())).status);
    expect(mocks.existing).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
const params = () => ({ params: Promise.resolve({ link: "community" }) });

describe.each([groupPost, channelPost])("shared key lifecycle", (post) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(async () => [{ id: "community", ownerId: "alice", myRole: "owner", isSubscribed: true, userId: "alice" }]);
    mocks.existing.mockResolvedValue({ id: "old-key" });
    mocks.latest.mockResolvedValueOnce({ version: 3 }).mockResolvedValue({ id: "old-key" });
    mocks.transaction.mockImplementation(async (callback) => {
      const model = { findFirst: mocks.latest, updateMany: mocks.update, create: mocks.create };
      const members = { findMany: vi.fn().mockResolvedValue([{ userId: "alice", role: "owner" }]) };
      return callback({ $executeRaw: mocks.lock, groupMember: members, channelSubscriber: members, groupE2EKey: model, channelE2EKey: model, groupE2EKeyMember: { upsert: mocks.upsert }, channelE2EKeyMember: { upsert: mocks.upsert } });
    });
  });
  it("does not reactivate old keys when rewrapping history", async () => {
    expect((await post(request(1), params())).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
  it("rejects a new version lower than the latest", async () => {
    mocks.existing.mockResolvedValue(null);
    expect((await post(request(2), params())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects an ordinary member rotating established keys", async () => {
    mocks.query.mockResolvedValue([{ id: "community", ownerId: "bob", myRole: "member", isSubscribed: true }]);
    expect((await post(request(4), params())).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
