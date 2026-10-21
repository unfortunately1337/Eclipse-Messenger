"use client";

import {
  ensureE2EIdentity, getE2EScopeGeneration, loadLegacyLocalE2EKeyPairs,
  loadStoredE2EKeyPairs, restoreE2EKeyringFromBackups, storeE2EIdentityFromBase64,
  storeE2EKeyPairToKeyring, validateE2EKeyPairBase64, type E2EIdentity,
} from "@/lib/client/e2e";
import { ensureE2EOwnerScope, getCachedE2EServerState, syncE2EIdentityToServer } from "@/lib/client/e2e-server-sync";

let inFlight: Promise<E2EIdentity> | null = null;

export function resolveE2EIdentity(options?: { force?: boolean }): Promise<E2EIdentity> {
  if (inFlight) return inFlight;
  const run = (async () => {
    await ensureE2EOwnerScope();
    const generation = getE2EScopeGeneration();
    const assertScope = () => {
      if (generation !== getE2EScopeGeneration()) throw new Error("Account changed during key recovery");
    };
    // A network failure is not proof that an account has no keys.
    const state = await getCachedE2EServerState({ force: options?.force });
    assertScope();
    const backups = state.backups?.length ? state.backups : state.backup ? [{ ...state.backup, isActive: true }] : [];
    const activePublic = state.publicKey ?? state.backup?.publicKey ?? backups.find(b => b.isActive)?.publicKey ?? null;
    await restoreE2EKeyringFromBackups(backups, activePublic);
    assertScope();
    // Keep the old keyring intact until all historical backups have been migrated.
    for (const pair of loadLegacyLocalE2EKeyPairs()) {
      if (!await validateE2EKeyPairBase64(pair)) continue;
      assertScope();
      storeE2EKeyPairToKeyring({ ...pair, makeActive: false });
    }
    const pair = loadStoredE2EKeyPairs().find(p => p.publicKeyBase64 === activePublic);
    let identity: E2EIdentity;
    if (pair && await validateE2EKeyPairBase64(pair)) {
      assertScope();
      identity = await storeE2EIdentityFromBase64(pair);
    } else {
      assertScope();
      if (activePublic || backups.length) {
        throw new Error("Keys could not be restored. Connect using QR from a device with access to your message history.");
      }
      identity = await ensureE2EIdentity({ restoreFromServer: false });
    }
    assertScope();
    // Local recovered keys remain usable if the backup upload is temporarily unavailable.
    await syncE2EIdentityToServer(identity).catch(() => {});
    assertScope();
    return identity;
  })();
  inFlight = run;
  void run.finally(() => { if (inFlight === run) inFlight = null; }).catch(() => {});
  return run;
}
