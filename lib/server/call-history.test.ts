import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallRecord } from "./calls";

const mock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), users: vi.fn(), invalidate: vi.fn(), notify: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { message: { create: mock.create, updateMany: mock.update }, user: { findMany: mock.users } } }));
vi.mock("./chat-list", () => ({ invalidateChatListPayloadCache: mock.invalidate }));
vi.mock("./realtime", () => ({ triggerRealtimeEvent: mock.notify, userPrivateChannel: (id: string) => `private-${id}` }));
import { createCallHistory, updateCallHistory } from "./call-history";

const base: CallRecord = { id: "call-id", kind: "direct", mode: "audio", status: "ringing", chatId: "chat", link: "bob", callerId: "alice", invitedIds: ["alice", "bob"], parties: {}, createdAt: 1000, startedAt: null, expiresAt: 99_000, revision: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  mock.create.mockResolvedValue({ id: "call:call-id", createdAt: new Date(1000) });
  mock.update.mockResolvedValue({ count: 1 });
  mock.users.mockResolvedValue([{ id: "alice", link: "alice-link", displayName: "Alice" }, { id: "bob", link: "bob-link", displayName: "Bob" }]);
  mock.notify.mockResolvedValue(undefined); mock.invalidate.mockResolvedValue(undefined);
});

describe("persistent personal call history", () => {
  it("stores one deterministic message and sends each participant their peer's chat link", async () => {
    await createCallHistory(base);
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: "call:call-id", conversationId: "chat", senderId: "alice", isSystemMessage: true }) }));
    expect(mock.notify).toHaveBeenCalledWith(expect.objectContaining({ channel: "private-alice", data: expect.objectContaining({ fromLink: "bob-link" }) }));
    expect(mock.notify).toHaveBeenCalledWith(expect.objectContaining({ channel: "private-bob", data: expect.objectContaining({ fromLink: "alice-link" }) }));
    expect(JSON.stringify(mock.notify.mock.calls)).not.toMatch(/sessionId|token|parties/);
  });
  it("updates the original message, records duration and prevents late acceptance overwriting the final state", async () => {
    await updateCallHistory({ ...base, status: "ended", startedAt: 2000, endedAt: 67_000, endReason: "completed" });
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "call:call-id", systemPayload: { path: ["metadata", "call", "status"], not: "ended" } }), data: { systemPayload: expect.objectContaining({ metadata: { call: expect.objectContaining({ durationSeconds: 65, outcome: "completed" }) } }) } }));
    await updateCallHistory({ ...base, status: "active", startedAt: 2000 });
    expect(mock.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ systemPayload: { path: ["metadata", "call", "status"], equals: "ringing" } }) }));
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("does not recreate deleted messages or re-emit a duplicate final update", async () => {
    mock.update.mockResolvedValue({ count: 0 });
    await updateCallHistory({ ...base, status: "ended", endedAt: 20_000, endReason: "declined" });
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.notify).not.toHaveBeenCalled();
  });
  it("never writes group-call history", async () => {
    await createCallHistory({ ...base, kind: "group" });
    await updateCallHistory({ ...base, kind: "group", status: "ended" });
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled(); expect(mock.notify).not.toHaveBeenCalled();
  });
});
