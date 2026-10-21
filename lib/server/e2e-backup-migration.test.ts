import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ key: vi.fn(), user: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback({ userE2EKey: { updateMany: mocks.key }, user: { updateMany: mocks.user } }) } }));
vi.mock("./e2e-storage", () => ({ encryptPublicKeyForDb: (value: string) => `enc:${value}`, encryptE2ESecretForDb: (value: string) => `protected:${value}` }));
import { replaceUserPrivateKeyBackup } from "./e2e-key";

describe("historical backup rewrapping", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.key.mockResolvedValue({ count: 1 }); mocks.user.mockResolvedValue({ count: 0 }); });
  it("updates only the backup ciphertext without reactivating an old key", async () => {
    await replaceUserPrivateKeyBackup({ userId: "alice", publicKeyBase64: "old-public", privateKeyBase64: "wrapped" });
    expect(mocks.key).toHaveBeenCalledWith({ where: { userId: "alice", publicKey: { in: ["enc:old-public", "old-public"] } }, data: { privateKeyBackupEnc: "protected:wrapped" } });
    expect(mocks.user.mock.calls[0][0].data).not.toHaveProperty("publicKey");
  });
  it("refuses to create an unregistered historical identity", async () => {
    mocks.key.mockResolvedValue({ count: 0 });
    await expect(replaceUserPrivateKeyBackup({ userId: "alice", publicKeyBase64: "unknown", privateKeyBase64: "wrapped" })).rejects.toThrow("not found");
  });
});
