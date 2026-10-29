import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    redis: {
      sadd: vi.fn(async () => 1),
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => { store.set(key, value); return "OK"; }),
      del: vi.fn(async (key: string) => Number(store.delete(key))),
      compareAndSet: vi.fn(async (key: string, expected: string, value: string) => {
        if (store.get(key) !== expected) return false;
        store.set(key, value); return true;
      }),
      setIfAbsent: vi.fn(async (key: string, value: string) => {
        if (store.has(key)) return false;
        store.set(key, value); return true;
      }),
      compareAndDelete: vi.fn(async (key: string, expected: string) => {
        if (store.get(key) !== expected) return false;
        return store.delete(key);
      }),
    },
    contact: { findUnique: vi.fn() },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    conversation: { findFirst: vi.fn() },
    groupMember: { findFirst: vi.fn(), findUnique: vi.fn() },
    group: { findUnique: vi.fn() },
    privacy: vi.fn(), allowed: vi.fn(),
    historyCreate: vi.fn(), historyUpdate: vi.fn(),
    create: vi.fn(), remove: vi.fn(), close: vi.fn(), issue: vi.fn(), notify: vi.fn(),
  };
});
vi.mock("./call-notifications", () => ({ deliverCallNotification: vi.fn(async () => {}) }));
vi.mock("./call-history", () => ({ createCallHistory: mock.historyCreate, updateCallHistory: mock.historyUpdate }));
vi.mock("./redis", () => ({ redis: mock.redis }));
vi.mock("./prisma", () => ({ prisma: { contact: mock.contact, user: mock.user, conversation: mock.conversation, group: mock.group, groupMember: mock.groupMember } }));
vi.mock("./privacy-settings", () => ({ getPrivacySettings: mock.privacy, canUserCall: mock.allowed }));
vi.mock("./livekit", () => ({ createCallRoom: mock.create, removeCallParticipant: mock.remove, deleteCallRoom: mock.close, issueCallConnection: mock.issue,
  callIdentity: (id: string, user: string) => `${id}:${user}` }));
vi.mock("./realtime", () => ({ triggerRealtimeChannels: mock.notify, userPrivateChannel: (id: string) => `private-${id}` }));

import { callView, connectionForCall, groupCall, heartbeatCall, joinCall, leaveCall, ownCall, reconcileCall, startCall, saveCallParticipantAudio } from "./calls";

const alice = { userId: "alice", sessionId: "alice-session" };
const bob = { userId: "bob", sessionId: "bob-session" };
beforeEach(() => {
  vi.resetAllMocks(); mock.store.clear();
  mock.user.findFirst.mockResolvedValue({ id: "bob", link: "bob", displayName: "Bob", isBot: false, isSystemAccount: false });
  mock.user.findMany.mockResolvedValue([{ id: "alice", displayName: "Alice", avatarUrl: null }, { id: "bob", displayName: "Bob", avatarUrl: null }]);
  mock.conversation.findFirst.mockResolvedValue({ id: "direct-chat" });
  mock.allowed.mockReturnValue(true); mock.privacy.mockResolvedValue({});
  mock.groupMember.findFirst.mockResolvedValue({ groupId: "group-chat", canPostMessages: true, role: "member", group: { name: "Test group", link: "testgroup" } });
  mock.groupMember.findUnique.mockResolvedValue({ canPostMessages: true, role: "member" });
  mock.group.findUnique.mockResolvedValue({ name: "Test group", link: "testgroup" });
  mock.issue.mockResolvedValue({ token: "synthetic-token", url: "wss://example.invalid", identity: "opaque" });
  mock.contact.findUnique.mockResolvedValue(null);
  mock.notify.mockResolvedValue(undefined);
  mock.historyCreate.mockResolvedValue(undefined); mock.historyUpdate.mockResolvedValue(undefined);
});

describe("call authorization and lifecycle", () => {
  it("uses the viewer's contact alias without exposing it to the other participant", async () => {
    const call = await startCall(alice, "direct", "audio", "bob");
    mock.contact.findUnique.mockResolvedValueOnce({ alias: "My friend" });
    const aliceView = await callView(call, alice);
    expect(aliceView.title).toBe("My friend");
    expect(aliceView.peer).toMatchObject({ id: "bob", name: "My friend" });
    expect(mock.contact.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId_peerId: { ownerId: "alice", peerId: "bob" } } }));
    expect((await callView(call, bob)).title).toBe("Alice");
    expect(JSON.stringify(mock.notify.mock.calls)).not.toContain("My friend");
  });

  it("records cancellation, rejection and connected duration as distinct final states", async () => {
    const cancelled = await startCall(alice, "direct", "audio", "bob");
    expect(await leaveCall(alice, cancelled.id, false)).toMatchObject({ endReason: "cancelled", startedAt: null });
    const declined = await startCall(alice, "direct", "audio", "bob");
    expect(await leaveCall(bob, declined.id, false)).toMatchObject({ endReason: "declined", startedAt: null });
    const completed = await startCall(alice, "direct", "video", "bob");
    await joinCall(bob, completed.id);
    const state = JSON.parse(mock.store.get(`calls:v1:record:${completed.id}`)!);
    state.startedAt = Date.now() - 65_000;
    mock.store.set(`calls:v1:record:${completed.id}`, JSON.stringify(state));
    const ended = await leaveCall(bob, completed.id, false);
    expect(ended).toMatchObject({ status: "ended", endReason: "completed" });
    expect(ended!.endedAt! - ended!.startedAt!).toBeGreaterThanOrEqual(65_000);
    const repeated = await leaveCall(alice, completed.id, false);
    expect(repeated!.endedAt).toBe(ended!.endedAt);
    expect(mock.historyUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: completed.id, endReason: "completed" }));
  });


  it("reserves both users, exposes an incoming call, and never exposes session IDs or join credentials in views/events", async () => {
    const call = await startCall(alice, "direct", "audio", "bob");
    expect((await ownCall("bob"))?.id).toBe(call.id);
    const view = await callView(call, bob);
    expect(view.incoming).toBe(true);
    expect(view.title).toBe("Alice");
    expect(JSON.stringify(view)).not.toMatch(/alice-session|bob-session|token|secret/);
    expect(JSON.stringify(mock.notify.mock.calls)).not.toMatch(/session|token|secret/);
    await expect(connectionForCall(bob, call.id)).rejects.toMatchObject({ status: 403 });
    await expect(connectionForCall({ userId: "stranger", sessionId: "stranger-session" }, call.id)).rejects.toMatchObject({ status: 403 });
    expect(mock.issue).not.toHaveBeenCalled();
  });

  it("allows acceptance on exactly one session and refuses other sessions' tokens or hangups", async () => {
    const call = await startCall(alice, "direct", "audio", "bob");
    const accepted = await joinCall(bob, call.id);
    expect(accepted.status).toBe("active");
    expect(accepted.startedAt).not.toBeNull();
    await expect(connectionForCall(bob, call.id)).resolves.toMatchObject({ token: "synthetic-token" });
    const other = { ...bob, sessionId: "other-session" };
    await expect(joinCall(other, call.id)).rejects.toMatchObject({ status: 409 });
    await expect(connectionForCall(other, call.id)).rejects.toMatchObject({ status: 403 });
    await expect(leaveCall(other, call.id, false)).rejects.toMatchObject({ status: 403 });
  });

  it("serializes competing calls without overwriting another call's reservations", async () => {
    const results = await Promise.allSettled([
      startCall(alice, "direct", "audio", "bob"),
      startCall(alice, "direct", "audio", "bob"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const current = await ownCall("alice");
    expect(current).not.toBeNull();
    expect((await ownCall("bob"))?.id).toBe(current!.id);
    expect(mock.close).toHaveBeenCalledTimes(1);
  });

  it("rejects bots, self calls, missing chats and privacy-restricted recipients before creating a room", async () => {
    mock.user.findFirst.mockResolvedValueOnce({ id: "bob", isBot: true });
    await expect(startCall(alice, "direct", "audio", "bob")).rejects.toMatchObject({ status: 400 });
    mock.user.findFirst.mockResolvedValueOnce({ id: "alice" });
    await expect(startCall(alice, "direct", "audio", "alice")).rejects.toMatchObject({ status: 400 });
    mock.conversation.findFirst.mockResolvedValueOnce(null);
    await expect(startCall(alice, "direct", "audio", "bob")).rejects.toMatchObject({ status: 403 });
    mock.allowed.mockReturnValueOnce(false);
    await expect(startCall(alice, "direct", "audio", "bob")).rejects.toMatchObject({ status: 403 });
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("hangs up for both participants, revokes Cloud access and frees their slots", async () => {
    const call = await startCall(alice, "direct", "audio", "bob");
    await joinCall(bob, call.id);
    await leaveCall(bob, call.id, false);
    expect(await ownCall("alice")).toBeNull();
    expect(await ownCall("bob")).toBeNull();
    expect(mock.remove).toHaveBeenCalledWith(call.id, "alice");
    expect(mock.remove).toHaveBeenCalledWith(call.id, "bob");
    expect(mock.close).toHaveBeenCalledWith(call.id);
    await expect(connectionForCall(alice, call.id)).rejects.toMatchObject({ status: 410 });
    await expect(heartbeatCall(alice, call.id)).rejects.toMatchObject({ status: 410 });
  });

  it("expires unanswered calls and cannot revive them by acceptance or heartbeat", async () => {
    const call = await startCall(alice, "direct", "audio", "bob");
    call.createdAt = Date.now() - 46_000;
    mock.store.set(`calls:v1:record:${call.id}`, JSON.stringify(call));
    expect(await reconcileCall(call.id)).toMatchObject({ status: "ended", endReason: "missed" });
    await expect(joinCall(bob, call.id)).rejects.toMatchObject({ status: 410 });
    expect(await ownCall("bob")).toBeNull();
  });

  it("keeps a group call alive when its creator leaves, and checks membership again before media access", async () => {
    const call = await startCall(alice, "group", "audio", "testgroup");
    await joinCall(bob, call.id);
    await leaveCall(alice, call.id, false);
    expect((await groupCall("testgroup", "bob"))?.id).toBe(call.id);
    expect(await ownCall("alice")).toBeNull();
    mock.groupMember.findUnique.mockResolvedValue(null);
    await expect(connectionForCall(bob, call.id)).rejects.toMatchObject({ status: 403 });
    await expect(heartbeatCall(bob, call.id)).rejects.toMatchObject({ status: 403 });
    expect(await ownCall("bob")).toBeNull();
    expect(mock.remove).toHaveBeenCalledWith(call.id, "bob");
  });

  it("does not let a kicked creator or ordinary participant end a group call for everyone", async () => {
    const call = await startCall(alice, "group", "audio", "testgroup");
    await joinCall(bob, call.id);
    await expect(leaveCall(bob, call.id, true)).rejects.toMatchObject({ status: 403 });
    mock.groupMember.findUnique.mockResolvedValueOnce(null);
    await expect(leaveCall(alice, call.id, true)).rejects.toMatchObject({ status: 403 });
    expect((await ownCall("bob"))?.status).toBe("active");
  });

  it("releases reservations if room setup fails and excludes stale group participants", async () => {
    mock.create.mockRejectedValueOnce(new Error("unavailable"));
    await expect(startCall(alice, "group", "audio", "testgroup")).rejects.toThrow("unavailable");
    expect(mock.store.size).toBe(0);
    const call = await startCall(alice, "group", "audio", "testgroup");
    await joinCall(bob, call.id);
    const state = JSON.parse(mock.store.get(`calls:v1:record:${call.id}`)!);
    state.parties.alice.lastSeen = Date.now() - 91_000;
    mock.store.set(`calls:v1:record:${call.id}`, JSON.stringify(state));
    expect((await reconcileCall(call.id))?.parties.alice).toBeUndefined();
    expect(await ownCall("alice")).toBeNull();
    expect((await ownCall("bob"))?.status).toBe("active");
  });
});

it("restores per-session peer audio in subsequent direct and group calls", async () => {
  const call = await startCall(alice, "direct", "audio", "bob");
  await saveCallParticipantAudio(alice, call.id, "bob", { volume: 0.5, muted: false });
  expect((await callView(call, alice)).audioPreferences?.bob).toEqual({ volume: 0.5, muted: false });
  expect((await callView(call, { ...alice, sessionId: "another-session" })).audioPreferences?.bob.volume).toBe(1);
  const group = { ...call, kind: "group" as const, chatId: "group-chat" };
  expect((await callView(group, alice)).audioPreferences?.bob.volume).toBe(0.5);
  expect((await callView(call, bob)).audioPreferences?.alice.volume).toBe(1);
});
it("rejects another session, self and nonparticipants changing audio preferences", async () => {
  const call = await startCall(alice, "direct", "audio", "bob");
  for (const [actor, peerId] of [[{ ...alice, sessionId: "other" }, "bob"], [alice, "alice"], [alice, "stranger"]] as const) {
    await expect(saveCallParticipantAudio(actor, call.id, peerId, { volume: 0.5, muted: true })).rejects.toMatchObject({ status: 403 });
  }
});
it("checks call privacy before creating a room and queues committed calls for recovery", async () => {
  mock.allowed.mockReturnValueOnce(false);
  await expect(startCall(alice, "direct", "audio", "bob")).rejects.toMatchObject({ status: 403 });
  expect(mock.create).not.toHaveBeenCalled();
  const call = await startCall(alice, "direct", "audio", "bob");
  expect(mock.redis.sadd).toHaveBeenCalledWith("calls:pending:v1", call.id);
});
it("blocks the third attempt after two explicit declines even through normal call creation", async () => {
  const first = await startCall(alice, "direct", "audio", "bob");
  await leaveCall(bob, first.id, false);
  const second = await startCall(alice, "direct", "audio", "bob");
  await leaveCall(bob, second.id, false);
  await expect(startCall(alice, "direct", "audio", "bob")).rejects.toMatchObject({ status: 429 });
  expect(mock.create).toHaveBeenCalledTimes(2);
});
it("retries terminal cleanup after a temporary guard-store failure instead of leaving room or users busy", async () => {
  const call = await startCall(alice, "direct", "audio", "bob");
  const originalGet = mock.redis.get.getMockImplementation()!;
  let fail = true;
  mock.redis.get.mockImplementation(async (key: string) => {
    if (key.startsWith("calls:guard:") && fail) { fail = false; throw new Error("temporary store outage"); }
    return originalGet(key);
  });
  await expect(leaveCall(bob, call.id, false)).rejects.toThrow("temporary store outage");
  expect(mock.store.get("calls:v1:user:alice")).toBe(call.id);
  mock.close.mockClear();
  await reconcileCall(call.id);
  expect(mock.close).toHaveBeenCalledWith(call.id);
  expect(mock.store.get(`calls:cleanup:v1:${call.id}`)).toBe("1");
});
