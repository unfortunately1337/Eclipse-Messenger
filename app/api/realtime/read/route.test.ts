import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ messages: vi.fn(), update: vi.fn(), grant: vi.fn(), privacy: vi.fn(), conversation: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: async () => ({ user: { id: "reader", link: "reader" } }) }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findUnique: async () => ({ id: "sender", link: "sender" }) }, message: { findMany: mock.messages }, $executeRaw: mock.update } }));
vi.mock("@/lib/server/presence", () => ({ grantInteractionPresence: mock.grant }));
vi.mock("@/lib/server/privacy-settings", () => ({ getPrivacySettings: mock.privacy, getPrivacyDisplayName: vi.fn() }));
vi.mock("@/lib/server/chat", () => ({ findDirectConversation: mock.conversation, SAVED_DIALOG_LINK: "saved", ECLIPSE_DIALOG_LINK: "eclipse", getOrCreateEclipseDialog: vi.fn() }));
vi.mock("@/lib/server/chat-list", () => ({ invalidateChatListPayloadCache: vi.fn() }));
vi.mock("@/lib/server/chat-read-state", () => ({ setGroupReadMarker: vi.fn(), setChannelReadMarker: vi.fn() }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn(), userPrivateChannel: (id: string) => id }));
import { POST } from "./route";
const request = () => new NextRequest("http://localhost/api/realtime/read", { method: "POST", body: JSON.stringify({ link: "sender", chatType: "direct", messageIds: ["message"] }) });
beforeEach(() => {
  vi.resetAllMocks(); mock.privacy.mockResolvedValue({ showReadReceipts: true }); mock.conversation.mockResolvedValue("conversation");
  mock.messages.mockResolvedValue([{ id: "message", createdAt: new Date() }]); mock.update.mockResolvedValue(1);
});
it("only reveals the authenticated reader to the sender of validated messages", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mock.messages).toHaveBeenCalledWith({ where: { id: { in: ["message"] }, conversationId: "conversation", senderId: "sender" }, select: { id: true, createdAt: true } });
  expect(mock.grant).toHaveBeenCalledExactlyOnceWith("reader", ["sender"]);
});
it("cannot gain visibility through unrelated or invented message IDs", async () => {
  mock.messages.mockResolvedValue([]); expect((await POST(request())).status).toBe(200); expect(mock.grant).not.toHaveBeenCalled();
});
it("does not prolong presence by replaying an already-read message", async () => {
  mock.update.mockResolvedValue(0); expect((await POST(request())).status).toBe(200); expect(mock.grant).not.toHaveBeenCalled();
});
it("does not indirectly reveal reading when read receipts are disabled", async () => {
  mock.privacy.mockResolvedValue({ showReadReceipts: false }); expect((await POST(request())).status).toBe(200);
  expect(mock.messages).not.toHaveBeenCalled(); expect(mock.grant).not.toHaveBeenCalled();
});
it("does not grant status without an authorized conversation", async () => {
  mock.conversation.mockResolvedValue(null); expect((await POST(request())).status).toBe(200);
  expect(mock.messages).not.toHaveBeenCalled(); expect(mock.grant).not.toHaveBeenCalled();
});
