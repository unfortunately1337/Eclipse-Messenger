import type { CallRecord } from "./calls";
import type { CallMessageData } from "@/lib/call-history";
import { prisma } from "./prisma";
import { invalidateChatListPayloadCache } from "./chat-list";
import { triggerRealtimeEvent, userPrivateChannel } from "./realtime";

const messageId = (id: string) => `call:${id}`;

function payload(call: CallRecord) {
  const calleeId = call.invitedIds.find(id => id !== call.callerId)!;
  const endedAt = call.endedAt ?? (call.status === "ended" ? call.createdAt : null);
  const details: CallMessageData = {
    id: call.id, callerId: call.callerId, calleeId, mode: call.mode, status: call.status,
    outcome: call.endReason ?? (call.status === "ended" ? (call.startedAt === null ? "missed" : "completed") : null),
    startedAt: call.startedAt, endedAt,
    durationSeconds: call.startedAt !== null && endedAt !== null ? Math.max(0, Math.floor((endedAt - call.startedAt) / 1000)) : 0,
  };
  return { eventType: "call" as const, title: "Звонок", body: "", metadata: { call: details } };
}

async function publish(call: CallRecord, message: { id: string; createdAt: Date }, name: "message:new" | "message:edited") {
  await invalidateChatListPayloadCache(call.invitedIds);
  const users = await prisma.user.findMany({ where: { id: { in: call.invitedIds } }, select: { id: true, link: true, displayName: true } });
  await Promise.all(users.map(async recipient => {
    const peer = users.find(user => user.id !== recipient.id);
    if (!peer) return;
    await triggerRealtimeEvent({ channel: userPrivateChannel(recipient.id), name, data: {
      chatType: "direct", id: message.id, conversationId: call.chatId, senderId: call.callerId,
      fromLink: peer.link, fromDisplayName: peer.displayName, isSystemMessage: true,
      systemPayload: payload(call), createdAt: message.createdAt.toISOString(),
    } }).catch(() => {});
  }));
}

export async function createCallHistory(call: CallRecord) {
  if (call.kind !== "direct") return;
  const message = await prisma.message.create({ data: {
    id: messageId(call.id), conversationId: call.chatId, senderId: call.callerId,
    isSystemMessage: true, systemPayload: payload(call), createdAt: new Date(call.createdAt),
  }, select: { id: true, createdAt: true } });
  await publish(call, message, "message:new").catch(() => { console.warn("Call history notification failed"); });
}

export async function updateCallHistory(call: CallRecord) {
  if (call.kind !== "direct" || call.status === "ringing") return;
  // Update only: an ended call must never resurrect a deleted history message.
  // The state predicate also prevents a delayed acceptance from undoing hangup.
  const result = await prisma.message.updateMany({ where: {
    id: messageId(call.id), conversationId: call.chatId, isSystemMessage: true,
    systemPayload: { path: ["metadata", "call", "status"], ...(call.status === "active" ? { equals: "ringing" } : { not: "ended" }) },
  }, data: { systemPayload: payload(call) } });
  if (result.count) await publish(call, { id: messageId(call.id), createdAt: new Date(call.createdAt) }, "message:edited").catch(() => { console.warn("Call history notification failed"); });
}
