import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ direct: vi.fn(), groupMessage: vi.fn(), channelPost: vi.fn(), groupMember: vi.fn(), channel: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getUserFromRequest: vi.fn().mockResolvedValue({ user: { id: "viewer" } }) }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  message: { findUnique: mocks.direct }, groupMessage: { findUnique: mocks.groupMessage }, channelPost: { findUnique: mocks.channelPost },
  groupMember: { findUnique: mocks.groupMember }, channel: { findFirst: mocks.channel },
} }));
vi.mock("@/lib/server/chat-read-state", () => ({ getGroupReadMarkers: vi.fn().mockResolvedValue(new Map()), getChannelReadMarkers: vi.fn().mockResolvedValue(new Map()) }));
import { GET } from "./route";

describe("notification payload authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.direct.mockResolvedValue(null);
    mocks.groupMessage.mockResolvedValue(null);
    mocks.channelPost.mockResolvedValue(null);
    mocks.groupMember.mockResolvedValue(null);
    mocks.channel.mockResolvedValue(null);
  });
  it.each(["group", "channel"])("does not disclose %s ciphertext to nonmembers or former members", async (kind) => {
    const message = { id: "message", groupId: "group", channelId: "channel", cipherText: "secret", iv: "iv", keyVersion: 1, createdAt: new Date() };
    (kind === "group" ? mocks.groupMessage : mocks.channelPost).mockResolvedValue(message);
    const res = await GET(new NextRequest("http://localhost/api/chats/notifications/payload?messageId=message"));
    expect(await res.json()).toEqual({ ok: true, data: { alreadyRead: false } });
    expect(kind === "group" ? mocks.groupMember : mocks.channel).toHaveBeenCalledOnce();
  });
  it.each(["group", "channel"])("preserves delivery for authorized %s members", async (kind) => {
    const message = { id: "message", groupId: "group", channelId: "channel", cipherText: "secret", iv: "iv", keyVersion: 1, createdAt: new Date() };
    (kind === "group" ? mocks.groupMessage : mocks.channelPost).mockResolvedValue(message);
    (kind === "group" ? mocks.groupMember : mocks.channel).mockResolvedValue({ id: kind });
    const res = await GET(new NextRequest("http://localhost/api/chats/notifications/payload?messageId=message"));
    expect((await res.json()).data.cipherText).toBe("secret");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
