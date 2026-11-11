import { expect, it } from "vitest";
import { areChatSidebarRowPropsEqual, type ChatSidebarRowProps } from "./chat-sidebar-row-equality";
const props = () => ({ row: { chat: { link: "peer", chatType: "direct" }, index: 0, unreadCount: 0, isTyping: false }, shared: { selfProfile: { id: "self" }, setSelectedLink: () => {} }, selected: false, isDirectOnlineVisible: false, helperOpen: false, chatOrderKey: "" }) as unknown as ChatSidebarRowProps;
it("reuses an unchanged chat row when another chat's selection, presence or unread count changes", () => {
  const previous = props();
  const next = { ...previous, row: { ...previous.row, index: 5 }, shared: { ...previous.shared, selectedLink: "another", onlineUserIds: new Set(["another"]), presenceNowTs: Date.now() } };
  expect(areChatSidebarRowPropsEqual(previous, next, ["setSelectedLink", "selfProfile"])).toBe(true);
});
it.each(["selected", "isDirectOnlineVisible", "helperOpen"] as const)("updates a row when its own %s changes", key => {
  const previous = props();
  expect(areChatSidebarRowPropsEqual(previous, { ...previous, [key]: true }, [])).toBe(false);
});
it("updates unread counts, typing, row order animations, theme and fresh event handlers", () => {
  const previous = props();
  for (const row of [{ ...previous.row, unreadCount: 2 }, { ...previous.row, isTyping: true }]) expect(areChatSidebarRowPropsEqual(previous, { ...previous, row }, [])).toBe(false);
  expect(areChatSidebarRowPropsEqual(previous, { ...previous, chatOrderKey: "new order" }, [])).toBe(false);
  expect(areChatSidebarRowPropsEqual(previous, { ...previous, shared: { ...previous.shared, setSelectedLink: () => {} } }, ["setSelectedLink"])).toBe(false);
  expect(areChatSidebarRowPropsEqual(previous, { ...previous, shared: { ...previous.shared, unreadBadgeThemeStyle: { color: "white" } } }, ["unreadBadgeThemeStyle"])).toBe(false);
});
it("a profile update refreshes Saved Messages without invalidating other chats", () => {
  const previous = props(), next = { ...previous, shared: { ...previous.shared, selfProfile: null } };
  expect(areChatSidebarRowPropsEqual(previous, next, ["selfProfile"])).toBe(true);
  const saved = { ...previous, row: { ...previous.row, chat: { ...previous.row.chat, chatType: "saved" as const } } };
  expect(areChatSidebarRowPropsEqual(saved, { ...saved, shared: next.shared }, ["selfProfile"])).toBe(false);
});
