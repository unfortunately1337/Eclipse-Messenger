import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ userRead: vi.fn(), keysRead: vi.fn(), keyUpdate: vi.fn(), userUpdate: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback({
  userE2EKey: { findMany: mocks.keysRead, updateMany: mocks.keyUpdate },
  user: { findUnique: mocks.userRead, updateMany: mocks.userUpdate },
}) } }));
vi.mock("./e2e-storage", () => ({
  decryptPublicKeyFromDb: (value: string) => value.replace(/^enc:/, ""),
  encryptPublicKeyForDb: (value: string) => `enc:${value}`,
  encryptE2ESecretForDb: (value: string) => `protected:${value}`,
}));
import { updatePasswordAndE2EBackups } from "./e2e-password-change";

describe("password and key-backup atomic update", () => {
  const input = { userId: "alice", oldPasswordHash: "old-hash", passwordHash: "new-hash", backups: [{ publicKey: "active", privateKey: "wrapped-active" }, { publicKey: "old", privateKey: "wrapped-old" }] };
  beforeEach(() => {
    vi.resetAllMocks(); mocks.userRead.mockResolvedValue({ publicKey: "enc:active" });
    mocks.keysRead.mockResolvedValue([{ publicKey: "enc:active" }, { publicKey: "enc:old" }]);
    mocks.userUpdate.mockResolvedValue({ count: 1 });
  });
  it("rewraps every historical key without changing active flags or the public identity", async () => {
    await updatePasswordAndE2EBackups(input);
    expect(mocks.keyUpdate).toHaveBeenCalledTimes(2);
    for (const [update] of mocks.keyUpdate.mock.calls) expect(Object.keys(update.data)).toEqual(["privateKeyBackupEnc"]);
    expect(mocks.userUpdate).toHaveBeenLastCalledWith({ where: { id: "alice", passwordHash: "old-hash" }, data: { passwordHash: "new-hash" } });
  });
  it("rejects missing historical keys and unregistered replacements before modifying data", async () => {
    for (const backups of [undefined, input.backups.slice(0, 1), [...input.backups, { publicKey: "bob", privateKey: "another-key" }]]) {
      await expect(updatePasswordAndE2EBackups({ ...input, backups })).rejects.toThrow("Restore all encryption keys");
    }
    expect(mocks.keyUpdate).not.toHaveBeenCalled(); expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
  it("aborts the transaction when another session changes the password concurrently", async () => {
    mocks.userUpdate.mockResolvedValue({ count: 0 });
    await expect(updatePasswordAndE2EBackups(input)).rejects.toThrow("another session");
  });
});
