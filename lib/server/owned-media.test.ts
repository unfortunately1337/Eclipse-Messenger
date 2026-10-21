import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ asset: vi.fn(), remove: vi.fn(), fileRemove: vi.fn(), references: Array.from({ length: 7 }, () => vi.fn()) }));
vi.mock("./prisma", () => ({ prisma: {
  mediaAsset: { findFirst: mock.asset, deleteMany: mock.remove },
  ...Object.fromEntries(["user", "group", "channel", "story", "conversationParticipant", "groupMessage", "channelPost"].map((table, i) => [table, { findFirst: mock.references[i] }])),
} }));
vi.mock("./media-storage", () => ({ deleteMediaObject: mock.fileRemove }));
import { deleteUnusedOwnedPublicMedia, localMediaKeys, requireOwnedPublicMedia } from "./owned-media";

const owned = { id: "asset", bucket: "actual-bucket", objectKey: "images/photo.png", status: "ready", scopeType: "public", clientEncrypted: false, kind: "image" };
beforeEach(() => { vi.resetAllMocks(); mock.asset.mockResolvedValue(owned); mock.references.forEach(fn => fn.mockResolvedValue(null)); });

it("rejects a foreign upload and filters by the authenticated owner", async () => {
  mock.asset.mockResolvedValue(null);
  await expect(requireOwnedPublicMedia("/media/images/photo.png", "attacker", "image")).rejects.toMatchObject({ status: 403 });
  expect(mock.asset).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: "attacker" }) }));
});
it.each([{ clientEncrypted: true }, { scopeType: "conversation" }, { kind: "video" }, { status: "pending" }, { expiresAt: new Date(0) }])("refuses private, encrypted, expired or wrong-kind media: %o", async patch => {
  mock.asset.mockResolvedValue({ ...owned, ...patch });
  await expect(requireOwnedPublicMedia("/media/images/photo.png", "owner", "image")).rejects.toMatchObject({ status: 403 });
});
it("does not let a legacy forged story/profile delete somebody else's file", async () => {
  mock.asset.mockResolvedValue(null);
  await deleteUnusedOwnedPublicMedia("/media/images/photo.png", "attacker");
  expect(mock.fileRemove).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
});
it.each([0, 1, 2, 3, 4, 5, 6])("preserves a file still referenced by table %i", async i => {
  mock.references[i].mockResolvedValue({ id: "reference" });
  await deleteUnusedOwnedPublicMedia("/media/images/photo.png", "owner");
  expect(mock.fileRemove).not.toHaveBeenCalled();
});
it("checks query-string URL variants and skips assets with chat access grants", async () => {
  await deleteUnusedOwnedPublicMedia("/media/images/photo.png?version=2", "owner");
  expect(mock.references[3]).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: expect.arrayContaining([{ mediaUrl: { startsWith: "/media/images/photo.png" } }]) } }));
  expect(mock.asset.mock.calls[0][0].where.accessGrants).toEqual({ none: {} });
});
it("deletes unreferenced owned media using its actual storage bucket", async () => {
  await deleteUnusedOwnedPublicMedia("/media/images/photo.png", "owner");
  expect(mock.fileRemove).toHaveBeenCalledWith("actual-bucket", "images/photo.png");
  expect(mock.remove).toHaveBeenCalledWith({ where: { id: "asset", ownerId: "owner" } });
});
it("rejects traversal and remote URLs", () => {
  expect(localMediaKeys("/media/../secret")).toBeNull(); expect(localMediaKeys("https://foreign/file")).toBeNull();
});
