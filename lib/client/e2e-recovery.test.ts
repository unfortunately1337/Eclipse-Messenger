import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/client/http", () => ({ apiRequest: request }));

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, clear: () => values.clear() };
}

async function device() {
  vi.resetModules();
  const localStorage = storage(), sessionStorage = storage();
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("sessionStorage", sessionStorage);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage }));
  return {
    e2e: await import("./e2e"),
    resolve: (await import("./e2e-identity")).resolveE2EIdentity,
    sync: await import("./e2e-server-sync"),
    qr: await import("./e2e-qr-transfer"),
    localStorage,
  };
}

describe("fresh-device key recovery", () => {
  let userId: string;
  let publicKey: string | null;
  let backups: { publicKey: string; privateKey: string; isActive: boolean }[];
  beforeEach(() => {
    userId = "alice"; publicKey = null; backups = [];
    request.mockReset().mockImplementation(async (url: string, options?: { method?: string; body?: string }) => {
      if (url === "/api/auth/me") return { id: userId };
      if (options?.method === "POST") {
        const body = JSON.parse(options.body!);
        if (url === "/api/settings/password") {
          for (const backup of backups) backup.privateKey = body.e2eBackups.find((b: { publicKey: string }) => b.publicKey === backup.publicKey).privateKey;
          return { changed: true };
        }
        if (url.endsWith("/backup")) {
          const existing = backups.find(b => b.publicKey === body.publicKey);
          if (!existing) throw new Error("Backup key not found");
          existing.privateKey = body.privateKey;
        } else {
          publicKey = body.publicKey;
          if (body.privateKeyBackup) backups = [...backups.filter(b => b.publicKey !== publicKey), { publicKey: publicKey!, privateKey: body.privateKeyBackup, isActive: true }];
        }
        return {};
      }
      if (url.endsWith("/backup")) return { backups: structuredClone(backups), backup: backups.find(b => b.isActive) ?? null };
      return { publicKey };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  async function history() {
    const oldDevice = await device();
    const e = oldDevice.e2e;
    const active = await e.createE2EIdentity(), old = await e.createE2EIdentity();
    const master = await e.derivePasswordMasterKeyBase64("  exact password  ", userId);
    publicKey = active.publicKeyBase64;
    for (const pair of [active, old]) backups.push({ publicKey: pair.publicKeyBase64, privateKey: await e.wrapPrivateKeyWithPassword(pair.privateKeyBase64, master), isActive: pair === active });
    const dm = await e.encryptMessageForUsers({ plainText: "DM history", senderPublicKeyBase64: old.publicKeyBase64, recipientPublicKeyBase64: old.publicKeyBase64 });
    const shared = [];
    for (const kind of ["group", "channel"]) {
      const keyBase64 = await e.generateSharedKeyBase64();
      shared.push({ kind, envelope: await e.encryptSharedKeyForUser({ sharedKeyBase64: keyBase64, recipientPublicKeyBase64: old.publicKeyBase64 }), encrypted: await e.encryptWithSharedKey({ plainText: `${kind} history`, keyBase64 }) });
    }
    return { active, old, master, dm, shared };
  }
  async function checkHistory(e: Awaited<ReturnType<typeof device>>["e2e"], h: Awaited<ReturnType<typeof history>>) {
    expect((await e.loadStoredE2EIdentity())?.publicKeyBase64).toBe(h.active.publicKeyBase64);
    expect(e.loadStoredE2EKeyPairs()).toHaveLength(2);
    expect(await e.decryptMessageWithKeyring({ ...h.dm, encryptedKey: h.dm.encryptedKeyForRecipient })).toBe("DM history");
    for (const item of h.shared) {
      const keyBase64 = await e.decryptSharedKeyWithKeyring(item.envelope);
      expect(await e.decryptWithSharedKey({ ...item.encrypted, keyBase64 })).toBe(`${item.kind} history`);
    }
  }
  it("restores active and historical identities after password login, including DMs/groups/channels", async () => {
    const h = await history(), next = await device();
    next.e2e.setActiveE2EUserId(userId);
    next.e2e.storePasswordMasterKey(h.master);
    const first = next.resolve(), second = next.resolve();
    expect(first).toBe(second); // Layout and chat view must share recovery.
    await first;
    await checkHistory(next.e2e, h);
    expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });
  it("does not generate or upload a replacement when the backup is locked or corrupted", async () => {
    const h = await history(), next = await device();
    next.e2e.setActiveE2EUserId(userId);
    next.e2e.storePasswordMasterKey(await next.e2e.derivePasswordMasterKeyBase64("wrong", userId));
    const generate = vi.spyOn(crypto.subtle, "generateKey");
    await expect(next.e2e.ensureE2EIdentity()).rejects.toThrow("Keys could not be restored");
    expect(generate).not.toHaveBeenCalled();
    generate.mockRestore();
    expect(publicKey).toBe(h.active.publicKeyBase64);
    expect(request.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });
  it("never promotes a readable historical backup over a locked active backup", async () => {
    const h = await history(), next = await device();
    next.e2e.setActiveE2EUserId(userId); next.e2e.storePasswordMasterKey(h.master);
    backups[0].privateKey = await next.e2e.wrapPrivateKeyWithPassword(h.active.privateKeyBase64, await next.e2e.derivePasswordMasterKeyBase64("another password", userId));
    await expect(next.resolve()).rejects.toThrow("Keys could not be restored");
    expect(next.e2e.loadStoredE2EKeyPairs().some(p => p.publicKeyBase64 === h.old.publicKeyBase64)).toBe(true);
    expect(publicKey).toBe(h.active.publicKeyBase64);
  });
  it("does not treat a failed server request as an empty account", async () => {
    const next = await device();
    request.mockImplementation(async (url: string) => { if (url.endsWith("/me")) return { id: userId }; throw new Error("offline"); });
    await expect(next.resolve()).rejects.toThrow("offline");
    expect(next.e2e.loadStoredE2EKeyPairs()).toHaveLength(0);
  });
  it("transfers history via QR without giving the server the decryption secret", async () => {
    const h = await history(), approving = await device();
    approving.e2e.setActiveE2EUserId(userId); approving.e2e.storePasswordMasterKey(h.master);
    const token = "00000000-0000-4000-8000-000000000001", secret = approving.qr.createQrKeySecret();
    const transfer = await approving.qr.encryptQrKeyTransfer(token, secret);
    expect(JSON.stringify(transfer)).not.toContain(h.active.privateKeyBase64);
    expect(JSON.stringify(transfer)).not.toContain(secret);
    const next = await device();
    await expect(next.qr.restoreQrKeyTransfer("different-token", secret, transfer, userId)).rejects.toThrow();
    await expect(next.qr.restoreQrKeyTransfer(token, next.qr.createQrKeySecret(), transfer, userId)).rejects.toThrow();
    const tampered = { ...transfer, cipherText: (transfer.cipherText[0] === "A" ? "B" : "A") + transfer.cipherText.slice(1) };
    await expect(next.qr.restoreQrKeyTransfer(token, secret, tampered, userId)).rejects.toThrow();
    await expect(next.qr.restoreQrKeyTransfer(token, secret, transfer, "bob")).rejects.toThrow("another account");
    expect(next.e2e.loadStoredE2EKeyPairs()).toHaveLength(0);
    await next.qr.restoreQrKeyTransfer(token, secret, transfer, userId);
    await next.resolve();
    await checkHistory(next.e2e, h);
    expect(next.e2e.loadPasswordMasterKey()).toBe(h.master);
  });
  it("migrates legacy backups under the password without deleting the legacy secret or rotating identity", async () => {
    const current = await device(); current.e2e.setActiveE2EUserId(userId);
    const active = await current.e2e.createE2EIdentity(), old = await current.e2e.createE2EIdentity();
    publicKey = active.publicKeyBase64;
    const master = await current.e2e.derivePasswordMasterKeyBase64("password", userId);
    current.e2e.storePasswordMasterKey(master);
    for (const pair of [active, old]) backups.push({ publicKey: pair.publicKeyBase64, privateKey: await current.e2e.wrapPrivateKeyForBackup(pair.privateKeyBase64), isActive: pair === active });
    await current.resolve();
    expect(backups.every(b => current.e2e.isPasswordBackupPayload(b.privateKey))).toBe(true);
    expect(backups.filter(b => b.isActive).map(b => b.publicKey)).toEqual([publicKey]);
    expect(current.e2e.loadBackupSecret()).toBeTruthy();
    const next = await device(); next.e2e.setActiveE2EUserId(userId); next.e2e.storePasswordMasterKey(master);
    await next.resolve(); expect(next.e2e.loadStoredE2EKeyPairs()).toHaveLength(2);
  });
  it("preserves exact MFA passwords and isolates new registration keys from the current account", async () => {
    const current = await device(); current.e2e.setActiveE2EUserId("alice");
    const alice = await current.e2e.ensureE2EIdentity({ restoreFromServer: false });
    const bob = await current.e2e.createE2EIdentity(); current.e2e.storeRegistrationE2EIdentity("bob", bob);
    expect((await current.e2e.loadStoredE2EIdentity())?.publicKeyBase64).toBe(alice.publicKeyBase64);
    current.e2e.storePendingPassword("  exact password  ");
    expect(current.e2e.consumePendingPassword()).toBe("  exact password  ");
    current.e2e.setActiveE2EUserId("bob");
    expect((await current.e2e.loadStoredE2EIdentity())?.publicKeyBase64).toBe(bob.publicKeyBase64);
    expect(bob.publicKeyBase64).not.toBe(alice.publicKeyBase64);
  });

  it("keeps all history readable after a password change and another fresh login", async () => {
    const h = await history(), current = await device();
    current.e2e.setActiveE2EUserId(userId); current.e2e.storePasswordMasterKey(h.master);
    await current.resolve();
    const { changePasswordWithE2EBackup } = await import("./e2e-password-change");
    await changePasswordWithE2EBackup("  exact password  ", "new password", "new password");
    const next = await device(); next.e2e.setActiveE2EUserId(userId);
    next.e2e.storePasswordMasterKey(await next.e2e.derivePasswordMasterKeyBase64("new password", userId));
    await next.resolve(); await checkHistory(next.e2e, h);
  });

  it("discards an in-flight recovery when the active account changes", async () => {
    const h = await history(), current = await device();
    current.e2e.setActiveE2EUserId(userId); current.e2e.storePasswordMasterKey(h.master);
    const original = request.getMockImplementation()!;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    request.mockImplementation(async (url: string, options?: { method: string }) => {
      if (url.endsWith("/backup") && options?.method === "GET") await pending;
      return original(url, options);
    });
    const recovery = current.resolve();
    await vi.waitFor(() => expect(request.mock.calls.some(([url]) => url.endsWith("/backup"))).toBe(true));
    current.e2e.setActiveE2EUserId("bob"); release();
    await expect(recovery).rejects.toThrow();
    expect(current.e2e.loadStoredE2EKeyPairs()).toHaveLength(0);
    expect(current.localStorage.getItem("eclipse:e2e:keyring:v2:bob")).toBeNull();
  });

  it("does not erase an account's keys because an unscoped legacy owner belongs to another account", async () => {
    const current = await device();
    current.e2e.setActiveE2EUserId("alice");
    current.localStorage.setItem("eclipse:e2e:owner-user-id", "bob");
    current.localStorage.setItem("eclipse:e2e:backup-secret", "bob-secret");
    const identity = await current.e2e.ensureE2EIdentity({ restoreFromServer: false });
    publicKey = identity.publicKeyBase64;
    await current.resolve();
    expect((await current.e2e.loadStoredE2EIdentity())?.publicKeyBase64).toBe(publicKey);
    expect(current.e2e.loadBackupSecret()).not.toBe("bob-secret");
  });
});
