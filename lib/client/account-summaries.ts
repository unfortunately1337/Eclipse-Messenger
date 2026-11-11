export type AccountSummary = {
  id: string; displayName: string; link: string; avatarUrl: string | null; isActive: boolean; unreadCount?: number;
};

/** Identical background polls must not invalidate the whole chat/profile tree. */
export function reconcileAccountSummaries(previous: AccountSummary[], incoming: AccountSummary[]) {
  const byId = new Map(previous.map(account => [account.id, account]));
  const next = incoming.map(account => {
    const cached = byId.get(account.id);
    return cached && cached.displayName === account.displayName && cached.link === account.link &&
      cached.avatarUrl === account.avatarUrl && cached.isActive === account.isActive && cached.unreadCount === account.unreadCount ? cached : account;
  });
  return next.length === previous.length && next.every((account, index) => account === previous[index]) ? previous : next;
}
