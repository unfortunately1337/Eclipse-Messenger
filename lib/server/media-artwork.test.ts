import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ asset: vi.fn(), grant: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { mediaAsset: { findFirst: mocks.asset }, mediaAssetAccess: { upsert: mocks.grant } } }));
import { grantCommunityArtwork } from "./media-artwork";

describe("community artwork cannot publish someone else's attachment", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects a foreign attachment even for a community administrator", async () => {
    mocks.asset.mockResolvedValue(null);
    await expect(grantCommunityArtwork("/media/private", "admin", "group", "g")).rejects.toThrow("собственное");
    expect(mocks.asset.mock.calls[0][0].where.ownerId).toBe("admin");
    expect(mocks.grant).not.toHaveBeenCalled();
  });
  it("refuses to publish a protected conversation asset", async () => {
    mocks.asset.mockResolvedValue({ id: "a", scopeType: "secret", clientEncrypted: true });
    await expect(grantCommunityArtwork("/media/private", "owner", "channel", "c")).rejects.toThrow("собственное");
    expect(mocks.grant).not.toHaveBeenCalled();
  });
  it("records explicit permission for an administrator's own uploaded artwork", async () => {
    mocks.asset.mockResolvedValue({ id: "a", scopeType: "public", clientEncrypted: false });
    await grantCommunityArtwork("/media/avatar", "admin", "group", "g");
    expect(mocks.grant).toHaveBeenCalledWith(expect.objectContaining({ create: { mediaAssetId: "a", scopeType: "group-artwork", scopeId: "g" } }));
  });
});
