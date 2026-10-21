"use client";

import {
  clearLocalE2EIdentity,
  isPasswordBackupPayload,
  isBackupPayloadWrapped,
  loadBackupSecret,
  unwrapPrivateKeyFromBackup,
  unwrapPrivateKeyWithPassword,
  validateE2EKeyPairBase64,
  loadE2EOwnerUserId,
  loadPasswordMasterKey,
  loadStoredE2EKeyPairs,
  setActiveE2EUserId,
  storeE2EOwnerUserId,
  wrapPrivateKeyForBackup,
  wrapPrivateKeyWithPassword,
} from "@/lib/client/e2e";
import { apiRequest } from "@/lib/client/http";

type BackupRecord = {
  publicKey: string;
  privateKey: string;
  isActive?: boolean;
};

type E2EServerState = {
  publicKey: string | null;
  backup: { publicKey: string; privateKey: string } | null;
  backups?: BackupRecord[];
};

const STATE_TTL_MS = 60_000;
const SYNC_TTL_MS = 120_000;
const STATE_FAILURE_COOLDOWN_MS = 10_000;
const SYNC_FAILURE_COOLDOWN_MS = 15_000;

let stateCache:
  | {
      value: E2EServerState;
      expiresAt: number;
    }
  | null = null;
let stateInFlight: Promise<E2EServerState> | null = null;
let lastStateFailureAt = 0;
let lastStateFailure: Error | null = null;

let lastSyncFingerprint: string | null = null;
let lastSyncAt = 0;
let syncInFlight: Promise<void> | null = null;
let lastSyncFailureAt = 0;
let lastSyncFailureFingerprint: string | null = null;
let scopeGeneration = 0;

function normalizeBackups(serverState: E2EServerState) {
  return Array.isArray(serverState.backups)
    ? serverState.backups
    : serverState.backup
      ? [{ ...serverState.backup, isActive: true }]
      : [];
}

export function invalidateE2EServerStateCache() {
  scopeGeneration += 1;
  stateCache = null;
  stateInFlight = null;
  lastStateFailureAt = 0;
  lastStateFailure = null;
  lastSyncFingerprint = null;
  lastSyncAt = 0;
  syncInFlight = null;
  lastSyncFailureAt = 0;
  lastSyncFailureFingerprint = null;
}

if (typeof window !== "undefined") window.addEventListener("eclipse:e2e-scope-changed", invalidateE2EServerStateCache);

export async function ensureE2EOwnerScope() {
  const me = await apiRequest<{ id: string }>("/api/auth/me", { method: "GET" });
  setActiveE2EUserId(me.id);
  const storedOwnerId = loadE2EOwnerUserId();
  if (storedOwnerId && storedOwnerId !== me.id) {
    clearLocalE2EIdentity();
    invalidateE2EServerStateCache();
  }
  storeE2EOwnerUserId(me.id);
  return me.id;
}

export async function getCachedE2EServerState(options?: { force?: boolean }) {
  const generation = scopeGeneration;
  const force = options?.force === true;
  const now = Date.now();

  if (!force && stateCache && stateCache.expiresAt > now) {
    return stateCache.value;
  }
  if (!force && lastStateFailureAt > 0 && now - lastStateFailureAt < STATE_FAILURE_COOLDOWN_MS) {
    if (stateCache?.value) {
      return stateCache.value;
    }
    throw lastStateFailure ?? new Error("Failed to fetch E2E state");
  }
  if (stateInFlight) {
    return stateInFlight;
  }

  const run = (async () => {
    const [backupState, keyState] = await Promise.all([
      apiRequest<{
        backup: { publicKey: string; privateKey: string } | null;
        backups?: BackupRecord[];
      }>("/api/settings/e2e-key/backup", { method: "GET" }),
      apiRequest<{ publicKey: string | null }>("/api/settings/e2e-key", { method: "GET" }),
    ]);

    const value: E2EServerState = {
      publicKey: keyState.publicKey,
      backup: backupState.backup,
      backups: backupState.backups,
    };
    if (generation !== scopeGeneration) throw new Error("Аккаунт изменился во время загрузки ключей");
    stateCache = {
      value,
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    lastStateFailureAt = 0;
    lastStateFailure = null;
    return value;
  })();

  stateInFlight = run;
  try {
    return await run;
  } catch (error) {
    if (generation === scopeGeneration) {
      lastStateFailureAt = Date.now();
      lastStateFailure = error instanceof Error ? error : new Error("Failed to fetch E2E state");
    }
    throw error;
  } finally {
    if (stateInFlight === run) stateInFlight = null;
  }
}

export async function syncE2EIdentityToServer(input: {
  publicKeyBase64: string;
  privateKeyBase64: string;
  force?: boolean;
}) {
  const generation = scopeGeneration;
  const requireSameScope = () => { if (generation !== scopeGeneration) throw new Error("Аккаунт изменился во время синхронизации ключей"); };
  const force = input.force === true;
  const passwordMaster = loadPasswordMasterKey();
  const hasPasswordMaster = Boolean(passwordMaster);
  const fingerprint = `${input.publicKeyBase64}:${hasPasswordMaster ? "password" : "legacy"}`;
  const now = Date.now();

  if (!force && lastSyncFingerprint === fingerprint && now - lastSyncAt < SYNC_TTL_MS) {
    return;
  }
  if (
    !force &&
    lastSyncFailureFingerprint === fingerprint &&
    now - lastSyncFailureAt < SYNC_FAILURE_COOLDOWN_MS
  ) {
    return;
  }
  if (syncInFlight) {
    return syncInFlight;
  }

  const run = (async () => {
    const serverState = force ? await getCachedE2EServerState({ force: true }) : await getCachedE2EServerState();
    requireSameScope();
    if (serverState.publicKey && serverState.publicKey !== input.publicKeyBase64) {
      throw new Error("Cannot replace the account key during backup synchronization");
    }
    const backups = normalizeBackups(serverState);
    // Migrate readable legacy backups, including historical pairs, to the login password.
    for (const backup of backups) {
      if (isPasswordBackupPayload(backup.privateKey)) continue;
      const local = loadStoredE2EKeyPairs().find(pair => pair.publicKeyBase64 === backup.publicKey);
      const privateKey = isBackupPayloadWrapped(backup.privateKey) ? local?.privateKeyBase64 : backup.privateKey;
      if (!privateKey || (isBackupPayloadWrapped(backup.privateKey) && !hasPasswordMaster)) continue;
      if (!await validateE2EKeyPairBase64({ publicKeyBase64: backup.publicKey, privateKeyBase64: privateKey })) continue;
      const wrapped = hasPasswordMaster
        ? await wrapPrivateKeyWithPassword(privateKey, passwordMaster as string)
        : await wrapPrivateKeyForBackup(privateKey);
      const restored = hasPasswordMaster
        ? await unwrapPrivateKeyWithPassword(wrapped, passwordMaster as string)
        : await unwrapPrivateKeyFromBackup(wrapped, loadBackupSecret()!);
      if (restored !== privateKey) throw new Error("Проверка резервной копии ключа не прошла");
      requireSameScope();
      await apiRequest("/api/settings/e2e-key/backup", { method: "POST", body: JSON.stringify({ publicKey: backup.publicKey, privateKey: wrapped, preserveActive: true }) });
      backup.privateKey = wrapped;
    }
    const existingBackup = backups.find((item) => item.publicKey === input.publicKeyBase64) ?? null;

    let nextBackupPayload = existingBackup?.privateKey ?? null;
    const shouldUploadBackup =
      force ||
      !existingBackup ||
      !isBackupPayloadWrapped(existingBackup.privateKey) ||
      (hasPasswordMaster && !isPasswordBackupPayload(existingBackup.privateKey));
    const shouldUploadPublicKey = serverState.publicKey !== input.publicKeyBase64;

    if (shouldUploadBackup) {
      nextBackupPayload = hasPasswordMaster
        ? await wrapPrivateKeyWithPassword(input.privateKeyBase64, passwordMaster as string)
        : await wrapPrivateKeyForBackup(input.privateKeyBase64);
      const restored = hasPasswordMaster
        ? await unwrapPrivateKeyWithPassword(nextBackupPayload, passwordMaster as string)
        : await unwrapPrivateKeyFromBackup(nextBackupPayload, loadBackupSecret()!);
      if (restored !== input.privateKeyBase64) throw new Error("Проверка резервной копии ключа не прошла");
    }

    if (shouldUploadPublicKey || shouldUploadBackup) {
      requireSameScope();
      await apiRequest("/api/settings/e2e-key", {
        method: "POST",
        body: JSON.stringify({
          publicKey: input.publicKeyBase64,
          ...(shouldUploadBackup ? { privateKeyBackup: nextBackupPayload } : {}),
        }),
      });
      requireSameScope();
      stateCache = {
        value: {
          publicKey: input.publicKeyBase64,
          backup: nextBackupPayload ? { publicKey: input.publicKeyBase64, privateKey: nextBackupPayload } : null,
          backups: [
            ...backups.filter(item => item.publicKey !== input.publicKeyBase64).map(item => ({ ...item, isActive: false })),
            ...(nextBackupPayload ? [{ publicKey: input.publicKeyBase64, privateKey: nextBackupPayload, isActive: true }] : []),
          ],
        },
        expiresAt: Date.now() + STATE_TTL_MS,
      };
    }

    requireSameScope();
    lastSyncFingerprint = fingerprint;
    lastSyncAt = Date.now();
    lastSyncFailureAt = 0;
    lastSyncFailureFingerprint = null;
  })();

  syncInFlight = run;
  try {
    await run;
  } catch (error) {
    if (generation === scopeGeneration) {
      lastSyncFailureAt = Date.now();
      lastSyncFailureFingerprint = fingerprint;
    }
    throw error;
  } finally {
    if (syncInFlight === run) syncInFlight = null;
  }
}
