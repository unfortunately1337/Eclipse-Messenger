import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const reactions = () => ({ findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({}) });
  return { groupMessage: vi.fn(), channelPost: vi.fn(), groupReactions: reactions(), channelReactions: reactions(), transaction: vi.fn().mockResolvedValue([]) };
});
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  message: { findFirst: vi.fn().mockResolvedValue(null) }, groupMessage: { findFirst: mocks.groupMessage }, channelPost: { findFirst: mocks.channelPost },
  groupMember: { findFirst: vi.fn().mockResolvedValue({ id: "membership" }), findMany: vi.fn().mockResolvedValue([]) },
  channelSubscriber: { findFirst: vi.fn().mockResolvedValue({ id: "membership" }), findMany: vi.fn().mockResolvedValue([]) },
  groupMessageReaction: mocks.groupReactions, channelPostReaction: mocks.channelReactions, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: vi.fn().mockResolvedValue({ user: { id: "reader" } }) }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn().mockResolvedValue(undefined), userPrivateChannel: (id: string) => id }));
import { POST } from "./route";

const send = (chatType: string, emoji: string) => POST(new NextRequest("http://localhost/api/reactions", { method: "POST", body: JSON.stringify({ chatType, emoji, messageId: "message" }) }));

describe.each(["group", "channel"] as const)("%s reaction restrictions", kind => {
  const setPolicy = (reactionMode: string, allowedReactions: string[] = []) => {
    const community = { ownerId: "owner", link: "community", isPublic: false, reactionMode, allowedReactions };
    if (kind === "group") mocks.groupMessage.mockResolvedValue({ id: "message", groupId: "group", group: community });
    else mocks.channelPost.mockResolvedValue({ id: "message", channelId: "channel", channel: community });
  };
  const store = kind === "group" ? mocks.groupReactions : mocks.channelReactions;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.groupMessage.mockResolvedValue(null);
    mocks.channelPost.mockResolvedValue(null);
    store.findMany.mockResolvedValue([]);
    setPolicy("all");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  it("allows the selected heart and refuses an unselected reaction without mutating storage", async () => {
    setPolicy("some", ["❤️"]);
    expect((await send(kind, "🔥")).status).toBe(403);
    expect(store.deleteMany).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect((await send(kind, "❤")).status).toBe(200);
    expect(store.create).toHaveBeenCalledOnce();
  });
  it("refuses additions when reactions are disabled, even with a forged direct chat type", async () => {
    setPolicy("none");
    expect((await send("direct", "❤️")).status).toBe(403);
    expect(store.create).not.toHaveBeenCalled();
  });
  it("allows removing an old reaction after it has been disabled", async () => {
    setPolicy("none");
    store.findMany.mockResolvedValue([{ emoji: "❤️", userId: "reader" }]);
    expect((await send(kind, "❤")).status).toBe(200);
    expect(store.deleteMany).toHaveBeenCalledOnce();
    expect(store.create).not.toHaveBeenCalled();
  });
  it("preserves the unrestricted all mode", async () => {
    expect((await send(kind, "🔥")).status).toBe(200);
    expect(store.create).toHaveBeenCalledOnce();
  });
});
