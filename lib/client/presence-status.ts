export function getPresenceStatusText(
  userId: string | null | undefined,
  onlineUserIds: Set<string>,
  _lastOfflineAtByUserId: Record<string, number>,
  _nowTs: number,
  _canDisplayPresence = true,
  _canDisplayLastSeen = _canDisplayPresence,
) {
  if (!userId) return "не в сети";
  // Online membership is authorized by a temporary, viewer-specific server grant.
  return onlineUserIds.has(userId) ? "в сети" : "был(а) недавно";
}
