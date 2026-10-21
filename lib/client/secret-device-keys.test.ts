import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { bindSecretDeviceKey, createSecretDeviceKey, decryptSecretDeviceMessage, deleteSecretDeviceKeys, loadSecretDeviceIdentity, secretSafetyCode, secretEncryptionContext } from "./secret-device-keys";
import { encryptMessageForUsers } from "./e2e";

const info = (key: { deviceKeyId: string; devicePublicKey: string }) => ({ version: 2, ownKeyId: key.deviceKeyId, ownPublicKey: key.devicePublicKey });
afterEach(async () => { await deleteSecretDeviceKeys("alice"); await deleteSecretDeviceKeys("bob"); });

describe("independent secret chat device keys", () => {
  it("roundtrips for two participants without exporting or backing up private keys", async () => {
    const alice = await createSecretDeviceKey("alice");
    const bob = await createSecretDeviceKey("bob");
    await bindSecretDeviceKey("alice", "chat", info(alice), bob.devicePublicKey);
    await bindSecretDeviceKey("bob", "chat", info(bob), alice.devicePublicKey);
    const identity = await loadSecretDeviceIdentity("alice", info(alice));
    expect(identity.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("pkcs8", identity.privateKey)).rejects.toThrow();
    const encrypted = await encryptMessageForUsers({ plainText: "secret", senderPublicKeyBase64: alice.devicePublicKey, recipientPublicKeyBase64: bob.devicePublicKey, context: secretEncryptionContext("chat") });
    for (const [ownerId, key, wrapped] of [["alice", alice, encrypted.encryptedKeyForSender], ["bob", bob, encrypted.encryptedKeyForRecipient]] as const) {
      expect(await decryptSecretDeviceMessage(ownerId, { ...encrypted, encryptedKey: `secret:v2:${key.deviceKeyId}:${wrapped}` })).toBe("secret");
    }
    await expect(decryptSecretDeviceMessage("alice", { ...encrypted, encryptedKey: `secret:v2:${bob.deviceKeyId}:${encrypted.encryptedKeyForRecipient}` })).rejects.toThrow();
    const replay = await encryptMessageForUsers({ plainText: "wrong chat", senderPublicKeyBase64: alice.devicePublicKey, recipientPublicKeyBase64: bob.devicePublicKey, context: secretEncryptionContext("another-chat") });
    await expect(decryptSecretDeviceMessage("alice", { ...replay, encryptedKey: `secret:v2:${alice.deviceKeyId}:${replay.encryptedKeyForSender}` })).rejects.toThrow();
    await deleteSecretDeviceKeys("bob", "chat");
    await expect(loadSecretDeviceIdentity("bob", info(bob))).rejects.toThrow();
    expect((await loadSecretDeviceIdentity("alice", info(alice))).publicKeyBase64).toBe(alice.devicePublicKey);
  });
  it("rejects changed peer keys, own keys and cross-chat reuse", async () => {
    const own = await createSecretDeviceKey("alice");
    await bindSecretDeviceKey("alice", "chat", info(own), "first-peer");
    await expect(bindSecretDeviceKey("alice", "chat", info(own), "replacement-peer")).rejects.toThrow("Ключ собеседника изменился");
    await expect(bindSecretDeviceKey("alice", "another", info(own), "first-peer")).rejects.toThrow();
    await expect(loadSecretDeviceIdentity("alice", { ...info(own), ownPublicKey: "replacement" })).rejects.toThrow();
  });
  it("does not restore an expired secret key", async () => {
    const own = await createSecretDeviceKey("alice");
    await expect(bindSecretDeviceKey("alice", "chat", info(own), null, new Date(0).toISOString())).rejects.toThrow("истёк");
  });
  it("does not extend an established lifetime when server metadata changes", async () => {
    const own = await createSecretDeviceKey("alice");
    const deadline = Date.now() + 60_000;
    await bindSecretDeviceKey("alice", "chat", info(own), null, new Date(deadline).toISOString());
    await bindSecretDeviceKey("alice", "chat", info(own), null, new Date(deadline + 3600_000).toISOString());
    await Promise.all([
      bindSecretDeviceKey("alice", "chat", info(own), null, new Date(deadline - 10_000).toISOString()),
      bindSecretDeviceKey("alice", "chat", info(own), null, new Date(deadline + 3600_000).toISOString()),
    ]);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("EclipseSecretDeviceKeys", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{ expiresAt: number }>((resolve, reject) => {
        const request = db.transaction("keys").objectStore("keys").get(own.deviceKeyId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(record.expiresAt).toBe(deadline - 10_000);
    } finally { db.close(); }
  });
  it("does not let simultaneous tabs overwrite a peer key pin", async () => {
    const own = await createSecretDeviceKey("alice");
    const results = await Promise.allSettled([
      bindSecretDeviceKey("alice", "chat", info(own), "peer-one"),
      bindSecretDeviceKey("alice", "chat", info(own), "peer-two"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });
  it("computes the same code in both directions and binds it to both keys and chat", async () => {
    const code = await secretSafetyCode("chat", ["alice", "bob"]);
    expect(await secretSafetyCode("chat", ["bob", "alice"])).toBe(code);
    expect(await secretSafetyCode("other", ["alice", "bob"])).not.toBe(code);
    expect(await secretSafetyCode("chat", ["alice", "replacement"])).not.toBe(code);
    expect(code.replaceAll(" ", "")).toHaveLength(64);
  });
});
