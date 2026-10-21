import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  community: vi.fn(), member: vi.fn(), members: vi.fn(), conversation: vi.fn(), secret: vi.fn(),
  find: vi.fn(), list: vi.fn(), write: vi.fn(), hidden: vi.fn(), hiddenList: vi.fn(),
}));
vi.mock("./prisma", () => ({ prisma: { $transaction: (run: (tx: unknown) => unknown) => run({
  $queryRaw: vi.fn().mockResolvedValue([]),
  group: { findUnique: mocks.community }, channel: { findUnique: mocks.community },
  groupMember: { findUnique: mocks.member, findMany: mocks.members }, channelSubscriber: { findUnique: mocks.member, findMany: mocks.members },
  conversation: { findUnique: mocks.conversation }, secretChat: { findUnique: mocks.secret },
  hiddenChatMessage: { findFirst: mocks.hidden, findMany: mocks.hiddenList },
  ...Object.fromEntries(["message", "groupMessage", "channelPost", "secretChatMessage"].map(key => [key, { findFirst: mocks.find, findMany: mocks.list, updateMany: mocks.write }])),
}) } }));
import { readMessagePins, writeMessagePin } from "./message-pins";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.community.mockResolvedValue({ ownerId: "owner", isPublic: false });
  mocks.member.mockResolvedValue({ role: "admin", canPinMessages: true });
  mocks.members.mockResolvedValue([{ userId: "admin" }]);
  mocks.conversation.mockResolvedValue({ type: "direct", isSystem: false, participants: [{ userId: "member" }] });
  mocks.secret.mockResolvedValue({ isApproved: true, expiresAt: new Date(Date.now() + 60_000), participants: [{ userId: "member", acceptedSessionId: "session" }] });
  mocks.hidden.mockResolvedValue(null);
  mocks.hiddenList.mockResolvedValue([]);
  mocks.find.mockResolvedValue({ id: "message" });
  mocks.write.mockResolvedValue({ count: 1 });
  mocks.list.mockResolvedValue([{ id: "message", createdAt: new Date(0), pinnedAt: new Date(1) }]);
});

it.each(["group", "channel"] as const)("allows owners/admins in %s but rejects ordinary members and outsiders", async chatType => {
  const scope = { chatType, chatId: "chat" };
  await expect(writeMessagePin(scope, "message", true, "owner", "session")).resolves.toBeDefined();
  await expect(writeMessagePin(scope, "message", true, "admin", "session")).resolves.toBeDefined();
  mocks.member.mockResolvedValue({ role: "admin", canPinMessages: false, canChangeReactions: true, canPostMessages: true });
  await expect(writeMessagePin(scope, "message", true, "admin", "session")).rejects.toMatchObject({ status: 403 });
  await expect(writeMessagePin(scope, "message", false, "admin", "session")).rejects.toMatchObject({ status: 403 });
  expect((await readMessagePins(scope, "admin", "session")).canManage).toBe(false);
  // Even an accidental stored grant must not turn an ordinary member into an administrator.
  mocks.member.mockResolvedValue({ role: "member", canPinMessages: true });
  await expect(writeMessagePin(scope, "message", true, "reader", "session")).rejects.toMatchObject({ status: 403 });
  mocks.member.mockResolvedValue(null);
  await expect(readMessagePins(scope, "outsider", "session")).rejects.toMatchObject({ status: 403 });
});

it("uses persisted direct-chat membership regardless of the supplied saved/system hint", async () => {
  await expect(writeMessagePin({ chatType: "saved", chatId: "chat" }, "message", true, "outsider", "session")).rejects.toMatchObject({ status: 403 });
  await expect(writeMessagePin({ chatType: "eclipse", chatId: "chat" }, "message", true, "member", "session")).resolves.toBeDefined();
  expect(mocks.hidden).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: "member", chatType: "direct", messageId: "message" } }));
});

it("checks the message's chat scope in both lookup and write, and repeated pinning preserves its order", async () => {
  await writeMessagePin({ chatType: "group", chatId: "chat" }, "message", true, "admin", "session");
  expect(mocks.find).toHaveBeenCalledWith({ where: { groupId: "chat", id: "message" }, select: { id: true } });
  expect(mocks.write).toHaveBeenCalledWith({ where: { groupId: "chat", id: "message", pinnedAt: null }, data: { pinnedAt: expect.any(Date) } });
  mocks.find.mockResolvedValue(null);
  await expect(writeMessagePin({ chatType: "group", chatId: "other" }, "message", true, "admin", "session")).rejects.toMatchObject({ status: 404 });
  expect(mocks.write).toHaveBeenCalledTimes(1);
});

it("does not expose deleted-for-me messages or plaintext/ciphertext in the pin list", async () => {
  mocks.hiddenList.mockResolvedValue([{ messageId: "message" }]);
  expect((await readMessagePins({ chatType: "direct", chatId: "chat" }, "member", "session")).pins).toEqual([]);
  mocks.hiddenList.mockResolvedValue([]);
  expect((await readMessagePins({ chatType: "direct", chatId: "chat" }, "member", "session")).pins).toEqual([{ id: "message", createdAt: new Date(0).toISOString(), pinnedAt: new Date(1).toISOString() }]);
  mocks.hidden.mockResolvedValue({ id: "hidden" });
  await expect(writeMessagePin({ chatType: "direct", chatId: "chat" }, "message", true, "member", "session")).rejects.toMatchObject({ status: 404 });
});

it("can unpin and enforces the accepted session and expiration of secret chats", async () => {
  const scope = { chatType: "secret" as const, chatId: "chat" };
  await writeMessagePin(scope, "message", false, "member", "session");
  expect(mocks.write).toHaveBeenCalledWith({ where: { secretChatId: "chat", id: "message" }, data: { pinnedAt: null } });
  await expect(readMessagePins(scope, "member", "other-session")).rejects.toMatchObject({ status: 403 });
  mocks.secret.mockResolvedValue({ isApproved: true, expiresAt: new Date(0), participants: [] });
  await expect(readMessagePins(scope, "member", "session")).rejects.toMatchObject({ status: 404 });
});
