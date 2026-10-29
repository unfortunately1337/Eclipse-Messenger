import { createHash, randomUUID } from "node:crypto";
import type { CallKind, CallMode, CallStatus, CallView } from "@/lib/calls";
import { CALL_GROUP_LIMIT } from "@/lib/calls";
import { redis } from "./redis";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { normalizeLink } from "./validation";
import { canUserCall, getPrivacySettings } from "./privacy-settings";
import { callIdentity, createCallRoom, deleteCallRoom, issueCallConnection, removeCallParticipant } from "./livekit";
import { triggerRealtimeChannels, userPrivateChannel } from "./realtime";
import { createCallHistory, updateCallHistory } from "./call-history";
import { deliverCallOnce } from "./call-delivery";
import { deliverCallNotification } from "./call-notifications";
import { assertCallCooldown, recordCallOutcome } from "./call-abuse";
import type { CallOutcome } from "@/lib/call-history";
import { readParticipantAudio, writeParticipantAudio, type ParticipantAudio } from "./call-audio";

const TTL = 8 * 60 * 60;
const RING_MS = 45_000;
const LEASE_MS = 90_000;
const recordKey = (id: string) => `calls:v1:record:${id}`;
const userKey = (id: string) => `calls:v1:user:${id}`;
const threadKey = (kind: CallKind, id: string) => `calls:v1:thread:${kind}:${id}`;
type Party = { sessionId: string; lastSeen: number };
export type CallRecord = {
  id: string; kind: CallKind; mode: CallMode; status: CallStatus; chatId: string;
  link: string; callerId: string; invitedIds: string[]; parties: Record<string, Party>;
  createdAt: number; startedAt: number | null; expiresAt: number; revision: number;
  endedAt?: number; endReason?: CallOutcome;
};
type Actor = { userId: string; sessionId: string };

async function read(id: string): Promise<CallRecord | null> {
  const raw = await redis.get(recordKey(id));
  return raw ? JSON.parse(raw) as CallRecord : null;
}

export async function notifyCall(call: CallRecord) {
  const ids = new Set([...call.invitedIds, ...Object.keys(call.parties)]);
  const results = await Promise.allSettled([deliverCallRealtime(call, [...ids]), deliverCallNotification(call)]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Call delivery deferred");
  return results.every(result => result.status === "fulfilled" && result.value);
}

async function release(call: CallRecord, extraIds: string[] = []) {
  await recordCallOutcome(call);
  await updateCallHistory(call).catch(() => { console.warn("Call history update failed"); });
  const ids = [...new Set([...call.invitedIds, ...Object.keys(call.parties), ...extraIds])];
  await Promise.all([
    redis.compareAndDelete(threadKey(call.kind, call.chatId), call.id),
    ...ids.map(id => redis.compareAndDelete(userKey(id), call.id)),
  ]);
  await Promise.all(ids.map(userId => removeCallParticipant(call.id, userId)));
  await deleteCallRoom(call.id);
  await redis.set(`calls:cleanup:v1:${call.id}`, "1", "EX", 3600);
}

async function mutate(id: string, update: (call: CallRecord) => void) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const raw = await redis.get(recordKey(id));
    if (!raw) throw new HttpError(410, "Звонок завершён");
    const call = JSON.parse(raw) as CallRecord;
    update(call);
    call.revision++;
    const seconds = call.status === "ended" ? 3600 : Math.max(1, Math.ceil((call.expiresAt - Date.now()) / 1000) + 120);
    if (await redis.compareAndSet(recordKey(id), raw, JSON.stringify(call), seconds)) return call;
  }
  throw new HttpError(409, "Состояние звонка изменилось. Повторите действие.");
}

// A lost tab must not leave the callee permanently busy. Every read reconciles
// leases; CAS prevents a delayed heartbeat from resurrecting an ended call.
export async function reconcileCall(id: string) {
  const current = await read(id);
  if (!current) return current;
  if (current.status === "ended") {
    if (!await redis.get(`calls:cleanup:v1:${current.id}`)) await release(current);
    return current;
  }
  const now = Date.now();
  if (current.expiresAt > now && (current.status !== "ringing" || current.createdAt + RING_MS > now) &&
      Object.values(current.parties).every(p => p.lastSeen + LEASE_MS > now)) return current;
  const removed: string[] = [];
  const next = await mutate(id, call => {
    removed.length = 0;
    if (call.status === "ended") return;
    const time = Date.now();
    for (const [userId, party] of Object.entries(call.parties)) {
      if (party.lastSeen + LEASE_MS <= time) { delete call.parties[userId]; removed.push(userId); }
    }
    if (call.expiresAt <= time || (call.status === "ringing" && call.createdAt + RING_MS <= time) ||
        !Object.keys(call.parties).length || (call.kind === "direct" && removed.length > 0)) {
      call.status = "ended";
      call.endedAt = time;
      call.endReason = call.startedAt === null ? "missed" : "completed";
    }
  });
  if (next.status === "ended") await release(next, removed);
  else await Promise.all(removed.map(async userId => {
    await redis.compareAndDelete(userKey(userId), id);
    await removeCallParticipant(id, userId);
  }));
  await notifyCall(next).catch(() => { console.warn("Call delivery queued for retry"); });
  return next;
}

async function pointer(key: string) {
  const id = await redis.get(key);
  if (!id) return null;
  const call = await reconcileCall(id);
  if (!call || call.status === "ended") { await redis.compareAndDelete(key, id); return null; }
  return call;
}

export async function ownCall(userId: string) { return pointer(userKey(userId)); }

export async function resolveCallTarget(kind: CallKind, rawLink: string, userId: string) {
  const link = normalizeLink(rawLink);
  if (kind === "group") {
    const member = await prisma.groupMember.findFirst({ where: { userId, group: { link } }, include: { group: true } });
    if (!member) throw new HttpError(403, "Вы не состоите в этой группе");
    if (!member.canPostMessages && member.role !== "owner") throw new HttpError(403, "Вам недоступны звонки в этой группе");
    return { chatId: member.groupId, link, title: member.group.name, invitedIds: [userId] };
  }
  const peer = await prisma.user.findFirst({ where: { OR: ["link", "link2", "link3", "link4", "link5"].map(key => ({ [key]: link })) },
    select: { id: true, link: true, displayName: true, isBot: true, isSystemAccount: true } });
  if (!peer || peer.id === userId || peer.isBot || peer.isSystemAccount) throw new HttpError(400, "Этому пользователю нельзя позвонить");
  const privacy = await getPrivacySettings(peer.id);
  if (!canUserCall(userId, peer.id, privacy)) throw new HttpError(403, "Пользователь ограничил входящие звонки");
  const chat = await prisma.conversation.findFirst({ where: { type: "direct", isSystem: false,
    AND: [{ participants: { some: { userId } } }, { participants: { some: { userId: peer.id } } }], participants: { every: { userId: { in: [userId, peer.id] } } } }, select: { id: true } });
  if (!chat) throw new HttpError(403, "Сначала откройте личный чат с пользователем");
  return { chatId: chat.id, link: peer.link, title: peer.displayName, invitedIds: [userId, peer.id] };
}

export async function assertCallAccess(call: CallRecord, userId: string) {
  if (call.kind === "group") {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: call.chatId, userId } } });
    if (!member || (!member.canPostMessages && member.role !== "owner")) throw new HttpError(403, "Вам недоступен этот звонок");
    return;
  }
  if (!call.invitedIds.includes(userId)) throw new HttpError(403, "Вам недоступен этот звонок");
  const chat = await prisma.conversation.findFirst({ where: { id: call.chatId, type: "direct", isSystem: false,
    participants: { some: { userId } } }, select: { id: true } });
  if (!chat) throw new HttpError(403, "Вам недоступен этот звонок");
}

export async function groupCall(link: string, userId: string) {
  const target = await resolveCallTarget("group", link, userId);
  return pointer(threadKey("group", target.chatId));
}

export async function startCall(actor: Actor, kind: CallKind, mode: CallMode, link: string) {
  const target = await resolveCallTarget(kind, link, actor.userId);
  const existing = await pointer(threadKey(kind, target.chatId));
  if (existing) {
    if (kind === "group") return joinCall(actor, existing.id);
    throw new HttpError(409, "В этом чате уже идёт звонок");
  }
  if (await ownCall(actor.userId)) throw new HttpError(409, "Сначала завершите текущий звонок");
  for (const id of target.invitedIds) if (await ownCall(id)) throw new HttpError(409, "Участник уже в другом звонке");
  if (kind === "direct") await assertCallCooldown(actor.userId, target.invitedIds.find(id => id !== actor.userId)!);
  const now = Date.now(), id = randomUUID();
  const call: CallRecord = { id, kind, mode, status: kind === "direct" ? "ringing" : "active", chatId: target.chatId,
    link: target.link, callerId: actor.userId, invitedIds: target.invitedIds,
    parties: { [actor.userId]: { sessionId: actor.sessionId, lastSeen: now } }, createdAt: now,
    startedAt: kind === "group" ? now : null, expiresAt: now + TTL * 1000, revision: 1 };
  await createCallRoom(id, kind === "direct" ? 2 : CALL_GROUP_LIMIT);
  const acquired: string[] = [];
  try {
    await redis.set(recordKey(id), JSON.stringify(call), "EX", TTL + 120);
    for (const key of [threadKey(kind, target.chatId), ...target.invitedIds.sort().map(userKey)]) {
      if (!await redis.setIfAbsent(key, id, TTL)) throw new HttpError(409, "Участник уже в другом звонке");
      acquired.push(key);
    }
    await createCallHistory(call);
    await redis.sadd("calls:pending:v1", id);
  } catch (error) {
    await Promise.all(acquired.map(key => redis.compareAndDelete(key, id)));
    await redis.del(recordKey(id));
    await deleteCallRoom(id);
    throw error;
  }
  await notifyCall(call).catch(() => { console.warn("Call delivery queued for retry"); });
  return call;
}

export async function joinCall(actor: Actor, id: string) {
  const initial = await reconcileCall(id);
  if (!initial || initial.status === "ended") throw new HttpError(410, "Звонок завершён");
  await assertCallAccess(initial, actor.userId);
  const busy = await ownCall(actor.userId);
  if (busy && busy.id !== id) throw new HttpError(409, "Сначала завершите текущий звонок");
  const reserved = !busy && await redis.setIfAbsent(userKey(actor.userId), id, TTL);
  if (!busy && !reserved) throw new HttpError(409, "Сначала завершите текущий звонок");
  try {
    const call = await mutate(id, state => {
      if (state.status === "ended" || state.expiresAt <= Date.now() || (state.status === "ringing" && state.createdAt + RING_MS <= Date.now())) throw new HttpError(410, "Звонок завершён");
      const party = state.parties[actor.userId];
      if (party && party.sessionId !== actor.sessionId) throw new HttpError(409, "Звонок открыт на другом устройстве");
      if (!party && Object.keys(state.parties).length >= CALL_GROUP_LIMIT) throw new HttpError(409, "В звонке уже максимальное число участников");
      if (state.kind === "direct" && actor.userId === state.callerId && state.status === "ringing") throw new HttpError(409, "Ожидаем ответа собеседника");
      state.parties[actor.userId] = { sessionId: actor.sessionId, lastSeen: Date.now() };
      state.status = "active";
      state.startedAt ??= Date.now();
    });
    await updateCallHistory(call).catch(() => { console.warn("Call history update failed"); });
    await notifyCall(call);
    return call;
  } catch (error) {
    if (reserved) await redis.compareAndDelete(userKey(actor.userId), id);
    throw error;
  }
}

export async function connectionForCall(actor: Actor, id: string) {
  const call = await reconcileCall(id);
  if (!call || call.status === "ended") throw new HttpError(410, "Звонок завершён");
  await assertCallAccess(call, actor.userId);
  if (call.parties[actor.userId]?.sessionId !== actor.sessionId) throw new HttpError(403, "Сначала примите звонок на этом устройстве");
  const connection = await issueCallConnection(id, actor.userId);
  const latest = await read(id);
  if (!latest || latest.status === "ended" || latest.parties[actor.userId]?.sessionId !== actor.sessionId) throw new HttpError(410, "Звонок завершён");
  return connection;
}

export async function heartbeatCall(actor: Actor, id: string) {
  const initial = await reconcileCall(id);
  if (!initial || initial.status === "ended") throw new HttpError(410, "Звонок завершён");
  try { await assertCallAccess(initial, actor.userId); }
  catch (error) {
    if (initial.parties[actor.userId]?.sessionId === actor.sessionId) await leaveCall(actor, id, false);
    throw error;
  }
  return mutate(id, call => {
    if (call.status === "ended") throw new HttpError(410, "Звонок завершён");
    if (call.parties[actor.userId]?.sessionId !== actor.sessionId) throw new HttpError(403, "Звонок открыт на другом устройстве");
    call.parties[actor.userId].lastSeen = Date.now();
  });
}

export async function leaveCall(actor: Actor, id: string, endForAll: boolean) {
  const initial = await reconcileCall(id);
  if (!initial) return null;
  if (!initial.invitedIds.includes(actor.userId) && !initial.parties[actor.userId]) throw new HttpError(403, "Вам недоступен этот звонок");
  if (initial.parties[actor.userId] && initial.parties[actor.userId].sessionId !== actor.sessionId) throw new HttpError(403, "Звонок открыт на другом устройстве");
  if (endForAll && initial.kind === "group") {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: initial.chatId, userId: actor.userId } } });
    if (!member || (initial.callerId !== actor.userId && !["owner", "admin"].includes(member.role))) throw new HttpError(403, "Недостаточно прав для завершения звонка");
  }
  const call = await mutate(id, state => {
    if (state.status === "ended") return;
    delete state.parties[actor.userId];
    if (state.kind === "direct" || endForAll || !Object.keys(state.parties).length) {
      state.status = "ended";
      state.endedAt = Date.now();
      state.endReason = state.startedAt !== null ? "completed" : actor.userId === state.callerId ? "cancelled" : "declined";
    }
  });
  if (call.status === "ended") await release(call, Object.keys(initial.parties));
  else {
    await redis.compareAndDelete(userKey(actor.userId), id);
    await removeCallParticipant(id, actor.userId);
  }
  await notifyCall({ ...call, invitedIds: [...new Set([...call.invitedIds, actor.userId])] }).catch(() => { console.warn("Call delivery queued for retry"); });
  return call;
}

export async function endedCallOutcome(actor: Actor, id: string) {
  const call = await read(id);
  if (!call || call.status !== "ended") return null;
  await assertCallAccess(call, actor.userId);
  return { id: call.id, outcome: call.endReason ?? (call.startedAt ? "completed" as const : "missed" as const) };
}

export async function saveCallParticipantAudio(actor: Actor, id: string, peerId: string, audio: ParticipantAudio) {
  const call = await read(id);
  if (!call || call.status === "ended") throw new HttpError(410, "Звонок завершён");
  await assertCallAccess(call, actor.userId);
  if (call.parties[actor.userId]?.sessionId !== actor.sessionId) throw new HttpError(403, "Звонок открыт на другом устройстве");
  if (peerId === actor.userId || (!call.invitedIds.includes(peerId) && !call.parties[peerId])) throw new HttpError(403, "Участник недоступен");
  await writeParticipantAudio(actor.sessionId, peerId, audio);
}

export async function callView(call: CallRecord, actor: Actor): Promise<CallView> {
  await assertCallAccess(call, actor.userId);
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set([...call.invitedIds, ...Object.keys(call.parties)])] } },
    select: { id: true, displayName: true, avatarUrl: true, backgroundUrl: true } });
  const group = call.kind === "group" ? await prisma.group.findUnique({ where: { id: call.chatId }, select: { name: true, link: true } }) : null;
  const peer = people.find(p => p.id !== actor.userId);
  const contact = call.kind === "direct" && peer ? await prisma.contact.findUnique({ where: { ownerId_peerId: { ownerId: actor.userId, peerId: peer.id } }, select: { alias: true } }) : null;
  const peerName = contact?.alias?.trim() || peer?.displayName || "Eclipse";
  const title = group?.name ?? peerName;
  return { id: call.id, kind: call.kind, mode: call.mode, status: call.status, link: group?.link ?? call.link,
    title, audioPreferences: await readParticipantAudio(actor.sessionId, people.filter(p => p.id !== actor.userId).map(p => p.id)),
    ...(call.kind === "direct" && peer ? { peer: { id: peer.id, name: peerName, avatarUrl: peer.avatarUrl, backgroundUrl: peer.backgroundUrl ?? null } } : {}),
    callerId: call.callerId, createdAt: call.createdAt, startedAt: call.startedAt, expiresAt: call.expiresAt,
    participantCount: Object.keys(call.parties).length,
    participants: people.filter(p => Boolean(call.parties[p.id])).map(p => ({ id: p.id, identity: callIdentity(call.id, p.id), name: p.displayName, avatarUrl: p.avatarUrl })),
    incoming: call.kind === "direct" && call.status === "ringing" && call.callerId !== actor.userId,
    onThisSession: call.parties[actor.userId]?.sessionId === actor.sessionId,
    canEnd: call.kind === "direct" || call.callerId === actor.userId };
}

async function deliverCallRealtime(call: CallRecord, ids: string[]) {
  const fingerprint = createHash("sha256").update(`${call.status}:${Object.keys(call.parties).sort().join(",")}`).digest("hex").slice(0, 24);
  return deliverCallOnce(`calls:realtime:v1:${call.id}:${fingerprint}`, () => triggerRealtimeChannels({ channels: ids.map(userPrivateChannel), name: "call:changed", data: { id: call.id, revision: call.revision, status: call.status } }));
}
