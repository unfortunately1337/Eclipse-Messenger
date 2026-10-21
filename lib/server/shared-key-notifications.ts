import { triggerRealtimeEvent, userPrivateChannel } from "./realtime";

const notifiedAt = new Map<string, number>();

// Only call after verifying current membership. No key material is sent in events.
export async function requestSharedHistoryKeys(kind: "group" | "channel", id: string, link: string, ownerId: string, requesterId: string) {
  if (ownerId === requesterId) return;
  const key = `${kind}:${id}:${requesterId}`;
  const now = Date.now();
  if (now - (notifiedAt.get(key) ?? 0) < 10_000) return;
  if (notifiedAt.size >= 2000) notifiedAt.clear();
  notifiedAt.set(key, now);
  await triggerRealtimeEvent({ channel: userPrivateChannel(ownerId), name: `${kind}:e2e-rotate`, data: kind === "group" ? { groupLink: link, groupId: id } : { channelLink: link, channelId: id } }).catch(() => {});
}

export async function notifySharedKeysReady(kind: "group" | "channel", link: string, version: number, recipientIds: string[]) {
  await Promise.allSettled(recipientIds.map(userId => triggerRealtimeEvent({
    channel: userPrivateChannel(userId), name: "shared:e2e-key-ready", data: { chatType: kind, link, version },
  })));
}
