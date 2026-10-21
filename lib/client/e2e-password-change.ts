"use client";

import { apiRequest } from "@/lib/client/http";
import {
  derivePasswordMasterKeyBase64, getE2EScopeGeneration, loadStoredE2EKeyPairs,
  restoreE2EKeyringFromBackups, storePasswordMasterKey, wrapPrivateKeyWithPassword,
} from "@/lib/client/e2e";
import { resolveE2EIdentity } from "@/lib/client/e2e-identity";
import { ensureE2EOwnerScope, getCachedE2EServerState, invalidateE2EServerStateCache } from "@/lib/client/e2e-server-sync";

export async function changePasswordWithE2EBackup(oldPassword: string, newPassword: string, confirmPassword: string) {
  const userId = await ensureE2EOwnerScope();
  const generation = getE2EScopeGeneration();
  const assertScope = () => { if (generation !== getE2EScopeGeneration()) throw new Error("Account changed during password update"); };
  const state = await getCachedE2EServerState({ force: true });
  assertScope();
  const backups = state.backups?.length ? state.backups : state.backup ? [{ ...state.backup, isActive: true }] : [];
  const oldMaster = await derivePasswordMasterKeyBase64(oldPassword, userId);
  assertScope();
  await restoreE2EKeyringFromBackups(backups, state.publicKey, oldMaster);
  const identity = await resolveE2EIdentity();
  assertScope();
  const master = await derivePasswordMasterKeyBase64(newPassword, userId);
  const keys = loadStoredE2EKeyPairs();
  const publicKeys = new Set([...backups.map(b => b.publicKey), identity.publicKeyBase64]);
  const e2eBackups = [];
  for (const publicKey of publicKeys) {
    const pair = keys.find(p => p.publicKeyBase64 === publicKey);
    if (!pair) throw new Error("Restore your key backup before changing the password to preserve message history.");
    e2eBackups.push({ publicKey, privateKey: await wrapPrivateKeyWithPassword(pair.privateKeyBase64, master) });
  }
  assertScope();
  await apiRequest("/api/settings/password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword, confirmPassword, e2eBackups }) });
  assertScope();
  storePasswordMasterKey(master);
  invalidateE2EServerStateCache();
}
