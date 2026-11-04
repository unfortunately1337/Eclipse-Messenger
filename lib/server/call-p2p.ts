import type { CallRecord } from "./calls";
import type { P2PCallConnection } from "@/lib/calls";
import type { CallSignalInbox, CallSignalInput, CallSignalMessage } from "@/lib/call-signaling";
import { redis } from "./redis";
import { HttpError } from "./http";
import { callIceConfiguration } from "./call-ice";
import { callIdentity } from "./livekit";
import { triggerRealtimeChannels, userPrivateChannel } from "./realtime";

type Actor = { userId: string; sessionId: string };
const leaseKey = (id: string, userId: string) => `calls:p2p:v1:lease:${id}:${userId}`;
const inboxKey = (id: string, userId: string) => `calls:p2p:v1:inbox:${id}:${userId}`;
const sequenceKey = (id: string, userId: string) => `calls:p2p:v1:sequence:${id}:${userId}`;
const ownerValue = (actor: Actor, clientId: string) => JSON.stringify([actor.sessionId, clientId]);
const leaseTtl = 120;

function assertP2P(call: CallRecord) {
  if (call.kind !== "direct" || call.transport !== "p2p" || call.invitedIds.length !== 2) throw new HttpError(409, "Этот звонок использует другой транспорт");
}
function assertActor(call: CallRecord, actor: Actor) {
  assertP2P(call);
  if (call.status === "ended") throw new HttpError(410, "Звонок завершён");
  if (!call.invitedIds.includes(actor.userId) || call.parties[actor.userId]?.sessionId !== actor.sessionId) throw new HttpError(403, "Сначала примите звонок на этом устройстве");
}
async function renewLease(call: CallRecord, actor: Actor, clientId: string) {
  assertActor(call, actor);
  const value = ownerValue(actor, clientId);
  if (!await redis.compareAndSet(leaseKey(call.id, actor.userId), value, value, leaseTtl)) throw new HttpError(409, "Звонок открыт в другой вкладке");
}

/** The caller must already have passed the call/session membership check. */
export async function p2pConnection(call: CallRecord, actor: Actor, clientId: string): Promise<P2PCallConnection> {
  assertActor(call, actor);
  const ice = callIceConfiguration(call.id, actor.userId);
  const key = leaseKey(call.id, actor.userId), value = ownerValue(actor, clientId);
  if (!await redis.setIfAbsent(key, value, leaseTtl) && !await redis.compareAndSet(key, value, value, leaseTtl)) throw new HttpError(409, "Звонок открыт в другой вкладке");
  const peerId = call.invitedIds.find(id => id !== actor.userId)!;
  return { transport: "p2p", callId: call.id, clientId, selfId: actor.userId, peerId,
    identity: callIdentity(call.id, actor.userId), peerIdentity: callIdentity(call.id, peerId),
    polite: actor.userId !== call.callerId, ...ice };
}

export async function sendP2PSignal(call: CallRecord, actor: Actor, input: CallSignalInput, defer?: (notify: () => Promise<void>) => void) {
  await renewLease(call, actor, input.clientId);
  const recipient = call.invitedIds.find(id => id !== actor.userId)!;
  const key = inboxKey(call.id, recipient);
  const message = JSON.stringify({ ...input, sequence: 0, sentAt: Date.now(), fromUserId: actor.userId });
  const budget = `calls:p2p:v1:bytes:${call.id}:${actor.userId}:${Math.floor(Date.now() / 60_000)}`;
  let reserved = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const raw = await redis.get(budget), next = Number(raw || 0) + Buffer.byteLength(message);
    if (next > 512 * 1024) throw new HttpError(429, "Слишком много запросов звонка");
    reserved = raw === null ? await redis.setIfAbsent(budget, String(next), 120) : await redis.compareAndSet(budget, raw, String(next), 120);
    if (reserved) break;
  }
  if (!reserved) throw new HttpError(409, "Повторите подключение к звонку");
  const sequence = await redis.appendBoundedEvent(key, sequenceKey(call.id, recipient), message, 120, 64, 256 * 1024);
  if (sequence < 0) return;
  // Only a hint goes to the realtime provider, never SDP, IPs or credentials.
  const hint = input.payload.type !== "candidates" || await redis.setIfAbsent(`calls:p2p:v1:hint:${call.id}:${recipient}`, "1", 1);
  if (hint) {
    const notify = async () => { await triggerRealtimeChannels({ channels: [userPrivateChannel(recipient)], name: "call:signal", data: { id: call.id } }).catch(() => {}); };
    // Persist before acknowledging, but do not stall the browser's serialized
    // SDP/ICE queue on a slow external hint provider. Next keeps after() alive.
    if (defer) defer(notify); else await notify();
  }
}

export async function readP2PSignals(call: CallRecord, actor: Actor, clientId: string, after: number): Promise<CallSignalInbox> {
  await renewLease(call, actor, clientId);
  const [raw, latest] = await redis.mget(inboxKey(call.id, actor.userId), sequenceKey(call.id, actor.userId));
  const retained: CallSignalMessage[] = raw ? JSON.parse(raw) : [];
  const messages = retained.filter(message => message.sequence > after);
  const cursor = Math.max(after, Number(latest || 0), ...messages.map(message => message.sequence));
  return { messages, cursor, reset: (cursor > after && !messages.length) || (after > 0 && messages.length > 0 && messages[0].sequence > after + 1) };
}

export async function releaseP2PCall(call: CallRecord) {
  await redis.del(...call.invitedIds.flatMap(userId => [leaseKey(call.id, userId), inboxKey(call.id, userId), sequenceKey(call.id, userId)]));
}
