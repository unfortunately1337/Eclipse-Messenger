import { redis } from "./redis";
export const INTERACTION_PRESENCE_SECONDS = 30;
const interactionKey = (observerId: string, subjectId: string) =>
  `presence:interaction:v1:${encodeURIComponent(observerId)}:${encodeURIComponent(subjectId)}`;

// Only a server-authorized send, read or typing action grants visibility.
// Opening the app does not expose activity, even with public privacy settings.
export async function grantInteractionPresence(subjectId: string, observerIds: string[]) {
  const expiresAt = String(Date.now() + INTERACTION_PRESENCE_SECONDS * 1000);
  await Promise.allSettled([...new Set(observerIds)].filter(id => id && id !== subjectId).map(id =>
    redis.set(interactionKey(id, subjectId), expiresAt, "EX", INTERACTION_PRESENCE_SECONDS),
  ));
}

export async function refreshPresence(viewerId: string, userIds: string[]) {
  return (await refreshPresenceSnapshot(viewerId, userIds)).onlineUserIds;
}

export async function refreshPresenceSnapshot(viewerId: string, userIds: string[]) {
  const ids = [...new Set(userIds)];
  const values = ids.length ? await redis.mget(...ids.map(id => interactionKey(viewerId, id))) : [];
  const now = Date.now();
  const onlineExpiresInMsByUserId: Record<string, number> = {};
  ids.forEach((id, index) => {
    const remaining = Number(values[index]) - now;
    if (Number.isFinite(remaining) && remaining > 0 && remaining <= INTERACTION_PRESENCE_SECONDS * 1000) {
      onlineExpiresInMsByUserId[id] = remaining;
    }
  });
  return {
    onlineUserIds: Object.keys(onlineExpiresInMsByUserId), onlineExpiresInMsByUserId,
    lastSeenAtByUserId: {}, hiddenLastSeenUserIds: ids,
  };
}
