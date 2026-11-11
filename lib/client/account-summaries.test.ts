import { expect, it } from "vitest";
import { reconcileAccountSummaries, type AccountSummary } from "./account-summaries";
const accounts: AccountSummary[] = [
  { id: "one", displayName: "One", link: "one", avatarUrl: null, isActive: true, unreadCount: 0 },
  { id: "two", displayName: "Two", link: "two", avatarUrl: null, isActive: false, unreadCount: 4 },
];
it("keeps the same state for an unchanged background response", () => {
  expect(reconcileAccountSummaries(accounts, accounts.map(account => ({ ...account })))).toBe(accounts);
});
it("updates counts and profile changes while retaining unaffected accounts", () => {
  const incoming = accounts.map(account => ({ ...account })); incoming[1].unreadCount = 5;
  const next = reconcileAccountSummaries(accounts, incoming);
  expect(next).not.toBe(accounts); expect(next[0]).toBe(accounts[0]); expect(next[1].unreadCount).toBe(5);
});
it("preserves server order, additions, removals and active account switches", () => {
  expect(reconcileAccountSummaries(accounts, [accounts[1], accounts[0]])).toEqual([accounts[1], accounts[0]]);
  expect(reconcileAccountSummaries(accounts, [])).toEqual([]);
  const next = reconcileAccountSummaries(accounts, accounts.map(account => ({ ...account, isActive: !account.isActive })));
  expect(next[0].isActive).toBe(false); expect(next[1].isActive).toBe(true);
});
