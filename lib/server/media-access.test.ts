import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), asset: vi.fn(), scope: vi.fn(), story: vi.fn(), user: vi.fn(), group: vi.fn(), channel: vi.fn() }));
vi.mock("./auth", () => ({ requireUserFromRequest: mocks.auth }));
vi.mock("./media-scope", () => ({ requireMediaScope: mocks.scope }));
vi.mock("./prisma", () => ({ prisma: { mediaAssetAccess: { findMany: vi.fn().mockResolvedValue([]) }, mediaAsset: { findFirst: mocks.asset }, story: { findFirst: mocks.story }, user: { findFirst: mocks.user }, group: { findFirst: mocks.group }, channel: { findFirst: mocks.channel } } }));
import { requireMediaAccess } from "./media-access";

describe("media authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue(null);
    mocks.group.mockResolvedValue(null);
    mocks.channel.mockResolvedValue(null);
    mocks.auth.mockRejectedValue(new Error("Unauthorized"));
    mocks.asset.mockResolvedValue({ ownerId: "owner", scopeType: "legacy", status: "ready", expiresAt: null });
    mocks.story.mockResolvedValue(null);
  });
  it("rejects anonymous access to ordinary attachments", async () => {
    await expect(requireMediaAccess(new NextRequest("http://localhost"), "media/file/key")).rejects.toThrow("Unauthorized");
  });
  it("retains public profile artwork before login", async () => {
    mocks.user.mockResolvedValue({ id: "user" });
    await requireMediaAccess(new NextRequest("http://localhost"), "media/image/avatar");
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("restricts anonymous community artwork to public communities", async () => {
    mocks.group.mockResolvedValue({ id: "group" });
    await requireMediaAccess(new NextRequest("http://localhost"), "media/image/avatar");
    expect(mocks.group).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isPublic: true }) }));
  });
  it("rejects an authenticated stranger holding a legacy URL", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "stranger" }, sessionId: "session" });
    await expect(requireMediaAccess(new NextRequest("http://localhost"), "media/file/key")).rejects.toThrow("Нет доступа");
  });
  it("checks the current chat ACL even when a protected URL is placed in public artwork", async () => {
    mocks.asset.mockResolvedValue({ ownerId: "owner", scopeType: "secret", scopeId: "chat", status: "ready", expiresAt: null });
    mocks.auth.mockResolvedValue({ user: { id: "stranger" }, sessionId: "session" });
    mocks.scope.mockRejectedValue(new Error("Forbidden"));
    mocks.user.mockResolvedValue({ id: "owner" });
    await expect(requireMediaAccess(new NextRequest("http://localhost"), "media/file/key")).rejects.toThrow("Forbidden");
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("denies expired assets before storage or authentication", async () => {
    mocks.asset.mockResolvedValue({ status: "ready", expiresAt: new Date(0) });
    await expect(requireMediaAccess(new NextRequest("http://localhost"), "media/file/key")).rejects.toThrow("недоступен");
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});
