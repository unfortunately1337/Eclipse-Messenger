import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ invite: vi.fn(), group: vi.fn(), channel: vi.fn(), transaction: vi.fn(), auth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  inviteLink: { findUnique: mocks.invite }, group: { findUnique: mocks.group }, channel: { findUnique: mocks.channel }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mocks.auth }));
vi.mock("@/lib/server/csrf", () => ({ ensureCsrfCookie: vi.fn(), verifyCsrf: vi.fn() }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn(), userPrivateChannel: vi.fn() }));
vi.mock("@/lib/server/chat-list", () => ({ invalidateChatListPayloadCache: vi.fn() }));
import { GET } from "@/app/api/invite/[token]/route";

const token = "a".repeat(48);
const get = (value = token) => GET(new NextRequest(`http://localhost/api/invite/${value}`), { params: Promise.resolve({ token: value }) });

describe("read-only invitation preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.invite.mockResolvedValue({ type: "group", groupId: "group", channelId: null, revokedAt: null, expiresAt: null });
    mocks.group.mockResolvedValue({ link: "my-group", name: "My group", description: "A group description", avatarUrl: "/avatar.webp", _count: { members: 122 } });
    mocks.channel.mockResolvedValue({ link: "my-channel", name: "My channel", description: null, avatarUrl: null, _count: { subscribers: 4500 } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns only group display metadata without joining, consuming a use or requiring a login", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ type: "group", link: "my-group", name: "My group", description: "A group description", avatarUrl: "/avatar.webp", count: 122 });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("uses subscriber counts and the channel avatar for channel invitations", async () => {
    mocks.invite.mockResolvedValue({ type: "channel", groupId: null, channelId: "channel", revokedAt: null, expiresAt: null });
    expect((await (await get()).json()).data).toEqual({ type: "channel", link: "my-channel", name: "My channel", description: null, avatarUrl: null, count: 4500 });
    expect(mocks.group).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects malformed tokens before querying any community", async () => {
    for (const value of ["invalid", "a".repeat(49), "../private"]) expect((await get(value)).status).toBe(404);
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.group).not.toHaveBeenCalled();
  });
  it("does not reveal metadata for missing, revoked, expired or orphaned links", async () => {
    for (const invite of [null, { type: "group", groupId: "group", revokedAt: new Date() }, { type: "group", groupId: "group", expiresAt: new Date(Date.now() - 1000) }, { type: "group", groupId: null }]) {
      mocks.invite.mockResolvedValue(invite);
      expect((await get()).status).toBe(404);
    }
    expect(mocks.group).not.toHaveBeenCalled();
    expect(mocks.channel).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not preview a deleted group", async () => {
    mocks.group.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
