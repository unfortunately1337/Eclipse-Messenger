import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ secret: vi.fn(), conversation: vi.fn(), group: vi.fn(), channel: vi.fn(), subscriber: vi.fn() }));
vi.mock("./chat", () => ({ findDirectConversation: vi.fn(), getOrCreateDirectConversation: vi.fn() }));
vi.mock("./privacy-settings", () => ({ canUserStartConversation: vi.fn(), getPrivacySettings: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: {
  secretChat: { findUnique: mocks.secret }, conversationParticipant: { findUnique: mocks.conversation },
  groupMember: { findUnique: mocks.group }, channel: { findUnique: mocks.channel }, channelSubscriber: { findUnique: mocks.subscriber },
} }));
import { requireMediaScope } from "./media-scope";
const scope = (scopeType: string) => ({ scopeType, scopeId: "chat", expiresAt: null });

describe("attachment conversation ACL", () => {
  beforeEach(() => vi.resetAllMocks());
  it("denies a stranger in a direct conversation and permits a participant", async () => {
    mocks.conversation.mockResolvedValue(null);
    await expect(requireMediaScope(scope("conversation"), "stranger", "session")).rejects.toThrow("Нет доступа");
    mocks.conversation.mockResolvedValue({ id: "member" });
    await requireMediaScope(scope("conversation"), "alice", "session");
  });
  it("checks current group membership and separate upload permission", async () => {
    mocks.group.mockResolvedValue(null);
    await expect(requireMediaScope(scope("group"), "removed", "session")).rejects.toThrow("Нет доступа");
    mocks.group.mockResolvedValue({ role: "member", canPostMessages: false });
    await requireMediaScope(scope("group"), "alice", "session");
    await expect(requireMediaScope(scope("group"), "alice", "session", true)).rejects.toThrow("Нет доступа");
  });
  it("permits channel owners and restricts subscriber uploads", async () => {
    mocks.channel.mockResolvedValue({ ownerId: "alice" });
    await requireMediaScope(scope("channel"), "alice", "session", true);
    mocks.subscriber.mockResolvedValue({ canPostMessages: false });
    await requireMediaScope(scope("channel"), "bob", "session");
    await expect(requireMediaScope(scope("channel"), "bob", "session", true)).rejects.toThrow("Нет доступа");
  });
  it("requires the accepted secret session and denies access exactly at expiry", async () => {
    mocks.secret.mockResolvedValue({ isApproved: true, expiresAt: new Date(Date.now()+60000), participants: [{ userId: "alice", acceptedSessionId: "accepted" }] });
    await expect(requireMediaScope(scope("secret"), "alice", "other-session")).rejects.toThrow("сессии");
    await requireMediaScope(scope("secret"), "alice", "accepted");
    await expect(requireMediaScope({ ...scope("secret"), expiresAt: new Date(0) }, "alice", "accepted")).rejects.toThrow("недоступен");
  });
  it("never lets another user read saved attachments", async () => {
    await expect(requireMediaScope({ ...scope("saved"), scopeId: "alice" }, "bob", "session")).rejects.toThrow("Нет доступа");
  });
});
