import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ chats: vi.fn(), assets: vi.fn(), orphans: vi.fn(), removeAsset: vi.fn(), removeChat: vi.fn(), removeObject: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { $queryRaw: mocks.orphans, secretChat: { findMany: mocks.chats, deleteMany: mocks.removeChat }, mediaAsset: { findMany: mocks.assets, deleteMany: mocks.removeAsset } } }));
vi.mock("./media-storage", () => ({ deleteMediaObject: mocks.removeObject }));
import { cleanupExpiredSecretChats } from "./secret-chat-cleanup";

describe("durable secret cleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.chats.mockResolvedValue([{ id: "expired" }]);
    mocks.assets.mockResolvedValueOnce([{ id: "file", bucket: "test", objectKey: "media/key" }]).mockResolvedValue([]);
    mocks.orphans.mockResolvedValue([]);
  });
  it("deletes storage before removing retry metadata and the chat", async () => {
    await cleanupExpiredSecretChats();
    expect(mocks.removeObject).toHaveBeenCalledWith("test", "media/key", { strict: true });
    expect(mocks.removeObject.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeAsset.mock.invocationCallOrder[0]);
    expect(mocks.removeAsset.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeChat.mock.invocationCallOrder[0]);
  });
  it("keeps metadata after a storage outage and retries successfully", async () => {
    mocks.removeObject.mockRejectedValueOnce(new Error("S3 unavailable"));
    await cleanupExpiredSecretChats();
    expect(mocks.removeAsset).not.toHaveBeenCalled();
    expect(mocks.removeChat).not.toHaveBeenCalled();
    mocks.assets.mockResolvedValueOnce([{ id: "file", bucket: "test", objectKey: "media/key" }]).mockResolvedValue([]);
    await cleanupExpiredSecretChats();
    expect(mocks.removeChat).toHaveBeenCalledOnce();
  });
  it("cleans late uploads even when their chat was manually removed before the original deadline", async () => {
    mocks.chats.mockResolvedValue([]);
    mocks.orphans.mockResolvedValue([{ id: "late-file", bucket: "test", objectKey: "late-key" }]);
    await cleanupExpiredSecretChats();
    expect(mocks.removeObject).toHaveBeenCalledWith("test", "late-key", { strict: true });
    expect(mocks.removeAsset).toHaveBeenCalledWith({ where: { id: "late-file" } });
  });
});
