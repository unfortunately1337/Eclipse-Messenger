type ReactionRow = { emoji: string; userId: string; user?: { avatarUrl: string | null } };

// Aggregate once per mutation, then personalize the same snapshot for every recipient.
export function createReactionSummarySnapshot(rows: readonly ReactionRow[], includeAvatars: boolean) {
  const grouped = new Map<string, { users: Set<string>; avatarUrl: string | null }>();
  for (const row of rows) {
    let group = grouped.get(row.emoji);
    if (!group) { group = { users: new Set(), avatarUrl: row.user?.avatarUrl ?? null }; grouped.set(row.emoji, group); }
    group.users.add(row.userId);
  }
  const ordered = [...grouped].sort(([a, left], [b, right]) => right.users.size - left.users.size || a.localeCompare(b));
  return (userId: string) => ordered.map(([emoji, group]) => ({
    emoji,
    count: group.users.size,
    reacted: group.users.has(userId),
    ...(includeAvatars ? { avatarUrl: group.users.size === 1 ? group.avatarUrl : null } : {}),
  }));
}
