import { expect, it } from "vitest";
import { mergeSecretChatSummaries } from "@/app/app/(chats)/chat-realtime-chatlist";
import type { ChatSummary } from "@/app/app/(chats)/types";

const chat = (id: string, approved = false): ChatSummary => ({
  chatType: "direct", conversationId: `secret:${id}`, link: `secret-${id}`, peerId: "peer",
  displayName: "Peer", avatarUrl: null, isApproved: approved, expiresAt: null,
  lastMessage: approved ? "Секретный чат" : "Ждем одобрения от Peer",
  lastMessageAt: "2026-11-01T01:00:00.000Z", lastMessageMine: false, unreadCount: 0,
});

it("retains the array for empty and unchanged polling snapshots", () => {
  const ordinary = { ...chat("normal"), conversationId: "normal", link: "peer" };
  const normalOnly = [ordinary];
  expect(mergeSecretChatSummaries(normalOnly, [])).toBe(normalOnly);
  const original = chat("one"), previous = [ordinary, original];
  expect(mergeSecretChatSummaries(previous, [{ ...original }])).toBe(previous);
});

it("does not advance a pending chat or reorder the list when polling creates a new current-time fallback", () => {
  const pending = chat("pending"), normal = { ...chat("normal"), conversationId: "normal", link: "peer", lastMessageAt: "2026-11-01T02:00:00.000Z" };
  const previous = [normal, pending];
  const polled = { ...pending, lastMessageAt: "2026-11-01T03:00:00.000Z" };
  expect(mergeSecretChatSummaries(previous, [polled])).toBe(previous);
  expect(previous[1].lastMessageAt).toBe("2026-11-01T01:00:00.000Z");
});

it("preserves live encrypted previews, unread state and extra cached fields while updating peer metadata", () => {
  const live = { ...chat("one", true), lastMessage: "Last actual message", lastMessageAt: "2026-11-01T04:00:00.000Z", unreadCount: 3,
    lastMessageMine: true, lastMessageCipherText: "cipher", lastMessageIv: "iv", lastMessageEncryptedKey: "key", lastMessageKeyVersion: 2,
    wallpaperUrl: "/wallpaper.jpg", statusText: "online" };
  const polled = { ...chat("one", true), displayName: "New name", avatarUrl: "/avatar.png", lastMessageCipherText: null, lastMessageIv: null };
  const result = mergeSecretChatSummaries<ChatSummary>([live], [polled]);
  expect(result[0]).toMatchObject({ ...live, displayName: "New name", avatarUrl: "/avatar.png" });
  expect(mergeSecretChatSummaries(result, [{ ...polled }])).toBe(result);
});

it("applies approval changes and removes only secret chats missing from the snapshot", () => {
  const pending = chat("pending"), expired = chat("expired"), ordinary = { ...chat("normal"), conversationId: "normal", link: "peer" };
  const approved = { ...pending, isApproved: true, expiresAt: "2026-11-01T05:00:00.000Z", lastMessage: "Секретный чат" };
  const result = mergeSecretChatSummaries([ordinary, pending, expired], [approved]);
  expect(result).toHaveLength(2); expect(result[0]).toBe(ordinary);
  expect(result[1]).toMatchObject({ isApproved: true, expiresAt: approved.expiresAt, lastMessage: "Секретный чат" });
});

it("keeps a read invitation read and inserts new chats in chronology without duplicating snapshot rows", () => {
  const read = chat("read"), newer = { ...chat("new"), lastMessageAt: "2026-11-01T06:00:00.000Z" };
  const result = mergeSecretChatSummaries([read], [{ ...read, unreadCount: 1 }, newer, { ...newer }]);
  expect(result.map(item => item.link)).toEqual(["secret-new", "secret-read"]);
  expect(result[1]).toBe(read);
});
