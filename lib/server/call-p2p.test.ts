import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { CallRecord } from "./calls";
import type { CallSignalInput } from "@/lib/call-signaling";

const setup = vi.hoisted(() => {
  // These tests must never connect to the application's real Redis database.
  delete process.env.REDIS_URL;
  return { connection: null as Redis | null, hint: vi.fn(async () => {}) };
});
vi.mock("./redis", async importOriginal => {
  if (!process.env.P2P_TEST_REDIS_URL) return importOriginal();
  const { default: Client } = await import("ioredis");
  const { createRemoteRedis } = await import("./redis-adapter");
  setup.connection = new Client(process.env.P2P_TEST_REDIS_URL, { maxRetriesPerRequest: 1 });
  return { redis: createRemoteRedis(setup.connection) };
});
vi.mock("./livekit", () => ({ callIdentity: (id: string, userId: string) => `${id}:${userId}` }));
vi.mock("./realtime", () => ({ triggerRealtimeChannels: setup.hint, userPrivateChannel: (id: string) => `private-${id}` }));
import { redis } from "./redis";
import { p2pConnection, readP2PSignals, releaseP2PCall, sendP2PSignal } from "./call-p2p";

const alice = { userId: "alice", sessionId: "session-a" };
const bob = { userId: "bob", sessionId: "session-b" };
const calls: CallRecord[] = [];
function call(first = alice, second = bob): CallRecord {
  const now = Date.now();
  const item: CallRecord = { id: randomUUID(), kind: "direct", transport: "p2p", mode: "audio", status: "active", chatId: randomUUID(), link: second.userId, callerId: first.userId, invitedIds: [first.userId, second.userId],
    parties: { [first.userId]: { sessionId: first.sessionId, lastSeen: now }, [second.userId]: { sessionId: second.sessionId, lastSeen: now } }, createdAt: now, startedAt: now, expiresAt: now + 3600_000, revision: 1 };
  calls.push(item); return item;
}
function input(clientId: string, payload: CallSignalInput["payload"] = { type: "ready" }): CallSignalInput {
  return { id: randomUUID(), epoch: randomUUID(), clientId, payload };
}
beforeEach(() => {
  vi.stubEnv("WEBRTC_TURN_URLS", "turn:turn.example.com:3478?transport=udp");
  vi.stubEnv("WEBRTC_TURN_SECRET", "test-only-secret-".repeat(4));
  setup.hint.mockClear();
});
afterEach(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await Promise.all(calls.splice(0).map(releaseP2PCall)); });
afterAll(async () => { await setup.connection?.quit(); });

it("requires the invited account, accepted session and a single browser lease", async () => {
  const item = call(), clientId = randomUUID();
  await expect(p2pConnection(item, { userId: "outsider", sessionId: alice.sessionId }, clientId)).rejects.toMatchObject({ status: 403 });
  await expect(p2pConnection(item, { ...alice, sessionId: "stolen-session" }, clientId)).rejects.toMatchObject({ status: 403 });
  expect(await p2pConnection(item, alice, clientId)).toMatchObject({ polite: false, selfId: "alice", peerId: "bob" });
  await expect(p2pConnection(item, alice, randomUUID())).rejects.toMatchObject({ status: 409 });
  await expect(sendP2PSignal(item, alice, input(randomUUID()))).rejects.toMatchObject({ status: 409 });
  const other = await p2pConnection(item, bob, randomUUID());
  expect(other.polite).toBe(true);
  item.status = "ended";
  await expect(readP2PSignals(item, bob, other.clientId, 0)).rejects.toMatchObject({ status: 410 });
  item.status = "active"; item.transport = "livekit";
  await expect(p2pConnection(item, alice, clientId)).rejects.toMatchObject({ status: 409 });
});

it("delivers SDP only to the peer inbox, with idempotent retries and realtime hints without SDP or credentials", async () => {
  const item = call(), a = randomUUID(), b = randomUUID();
  await Promise.all([p2pConnection(item, alice, a), p2pConnection(item, bob, b)]);
  const event = input(a, { type: "description", negotiationId: randomUUID(), description: { type: "offer", sdp: "v=0\r\na=test-private-sdp" } });
  await sendP2PSignal(item, alice, event); await sendP2PSignal(item, alice, event);
  const inbox = await readP2PSignals(item, bob, b, 0);
  expect(inbox.messages).toHaveLength(1);
  expect(inbox.messages[0]).toMatchObject({ sequence: 1, fromUserId: "alice", payload: event.payload });
  expect((await readP2PSignals(item, alice, a, 0)).messages).toEqual([]);
  expect((await readP2PSignals(item, bob, b, inbox.cursor)).messages).toEqual([]);
  expect(setup.hint).toHaveBeenCalledTimes(1);
  expect(setup.hint).toHaveBeenCalledWith({ channels: ["private-bob"], name: "call:signal", data: { id: item.id } });
});

it("bounds retained signaling and reports a missing interval instead of silently skipping an offer", async () => {
  const item = call(), a = randomUUID(), b = randomUUID();
  await Promise.all([p2pConnection(item, alice, a), p2pConnection(item, bob, b)]);
  for (let i = 0; i < 70; i++) await sendP2PSignal(item, alice, input(a));
  const inbox = await readP2PSignals(item, bob, b, 1);
  expect(inbox.messages).toHaveLength(64); expect(inbox.reset).toBe(true); expect(inbox.cursor).toBe(70);
  await redis.del(`calls:p2p:v1:inbox:${item.id}:bob`);
  expect(await readP2PSignals(item, bob, b, 69)).toMatchObject({ messages: [], reset: true, cursor: 70 });
});

it("commits SDP before the response without waiting for an external realtime hint", async () => {
  const item = call(), a = randomUUID(), b = randomUUID(), deferred: Array<() => Promise<void>> = [];
  await Promise.all([p2pConnection(item, alice, a), p2pConnection(item, bob, b)]);
  await sendP2PSignal(item, alice, input(a), notify => deferred.push(notify));
  expect(setup.hint).not.toHaveBeenCalled();
  expect((await readP2PSignals(item, bob, b, 0)).messages).toHaveLength(1);
  expect(deferred).toHaveLength(1); await deferred[0]();
  expect(setup.hint).toHaveBeenCalledTimes(1);
});

it("caps bytes even when a client rotates message IDs", async () => {
  const item = call(), a = randomUUID(); await p2pConnection(item, alice, a);
  const large = () => input(a, { type: "description", negotiationId: randomUUID(), description: { type: "offer", sdp: "x".repeat(64 * 1024) } });
  for (let i = 0; i < 7; i++) await sendP2PSignal(item, alice, large());
  await expect(sendP2PSignal(item, alice, large())).rejects.toMatchObject({ status: 429 });
  const inbox = await redis.get(`calls:p2p:v1:inbox:${item.id}:bob`);
  expect(Buffer.byteLength(inbox!)).toBeLessThanOrEqual(256 * 1024);
});

it("keeps all 50 simultaneous call pairs isolated and sequences concurrent opposite-direction signaling", async () => {
  await Promise.all(Array.from({ length: 50 }, async (_, index) => {
    const first = { userId: `alice-${index}`, sessionId: `alice-session-${index}` }, second = { userId: `bob-${index}`, sessionId: `bob-session-${index}` };
    const item = call(first, second), a = randomUUID(), b = randomUUID();
    await Promise.all([p2pConnection(item, first, a), p2pConnection(item, second, b)]);
    await Promise.all([[first, a], [second, b]].map(async ([actor, client]) => {
      for (let index = 0; index < 20; index++) await sendP2PSignal(item, actor as typeof alice, input(client as string));
    }));
    for (const [actor, clientId, sender] of [[first, a, second.userId], [second, b, first.userId]] as const) {
      const inbox = await readP2PSignals(item, actor, clientId, 0);
      expect(inbox.messages).toHaveLength(20);
      expect(inbox.messages.map(message => message.sequence)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(inbox.messages.every(message => message.fromUserId === sender)).toBe(true);
      expect(inbox.reset).toBe(false);
    }
  }));
}, 20_000);
