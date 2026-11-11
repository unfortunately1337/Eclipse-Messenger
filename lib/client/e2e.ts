"use client";

import { apiRequest } from "@/lib/client/http";

const PRIVATE_KEY_STORAGE = "eclipse:e2e:private-key";
const PUBLIC_KEY_STORAGE = "eclipse:e2e:public-key";
const BACKUP_SECRET_STORAGE = "eclipse:e2e:backup-secret";
const KEYRING_STORAGE = "eclipse:e2e:keyring:v1";
const KEYRING_STORAGE_V2 = "eclipse:e2e:keyring:v2";
const LEGACY_BACKUP_WRAPPER_PREFIX = "zkv1:";
const PASSWORD_BACKUP_WRAPPER_PREFIX = "pwv1:";
const PASSWORD_MASTER_KEY_STORAGE = "eclipse:e2e:pwd-master:v1";
const PASSWORD_PENDING_STORAGE = "eclipse:e2e:pwd-pending:v1";
const E2E_OWNER_USER_ID_STORAGE = "eclipse:e2e:owner-user-id";
const E2E_SYNC_MARKER_SESSION_KEY = "e2e-sync-public-key";
const PASSWORD_DERIVATION_ITERATIONS = 150_000;

// Legacy keys accidentally used in previous builds. Keep migration support.
const LEGACY_PRIVATE_KEY_STORAGE = "MC4CAQAwBQYDK2VuBCIEIG8J4GdS5Tz8hVq6k1x0wZxWm4c7j7vZ1z2KqP9mYp8R"; // gitleaks:allow -- Legacy localStorage property name, not encryption key material.
const LEGACY_PUBLIC_KEY_STORAGE = "MCowBQYDK2VuAyEA5yZkF2wV8x1yJq3nQ0k9lVvP3z6YkW4pT2nQh6YpV7I=";

let memoryPrivateKeyBase64: string | null = null;
let memoryPublicKeyBase64: string | null = null;
let memoryKeyring: E2EKeyring = { activePublicKeyBase64: null, keys: [] };
let keyringHydrated = false;
const importedPublicKeyCache = new Map<string, CryptoKey>();
const importedPrivateKeyCache = new Map<string, CryptoKey>();
const importedSharedKeyCache = new Map<string, CryptoKey>();
let importedKeyGeneration = 0;

type E2EKeyring = {
  activePublicKeyBase64: string | null;
  keys: { publicKeyBase64: string; privateKeyBase64: string; createdAt: number }[];
};

function normalizeKeyring(raw: unknown): E2EKeyring {
  if (!raw || typeof raw !== "object") {
    return { activePublicKeyBase64: null, keys: [] };
  }
  const parsed = raw as { activePublicKeyBase64?: unknown; keys?: unknown };
  const keys = Array.isArray(parsed.keys)
    ? parsed.keys
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof (item as { publicKeyBase64?: unknown }).publicKeyBase64 === "string" &&
            typeof (item as { privateKeyBase64?: unknown }).privateKeyBase64 === "string",
        )
        .map((item) => ({
          publicKeyBase64: (item as { publicKeyBase64: string }).publicKeyBase64,
          privateKeyBase64: (item as { privateKeyBase64: string }).privateKeyBase64,
          createdAt:
            typeof (item as { createdAt?: unknown }).createdAt === "number"
              ? (item as { createdAt: number }).createdAt
              : Date.now(),
        }))
    : [];
  const activePublicKeyBase64 =
    typeof parsed.activePublicKeyBase64 === "string" ? parsed.activePublicKeyBase64 : null;
  return { activePublicKeyBase64, keys };
}

function saveKeyringToIndexedDB(keyring: E2EKeyring) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const scopedKey = getScopedKey("eclipse:e2e:keyringData");
  const generation = importedKeyGeneration;
  try {
    const request = indexedDB.open("EclipseE2EKeys", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keyring")) {
        db.createObjectStore("keyring");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (generation !== importedKeyGeneration) { db.close(); return; }
      const tx = db.transaction("keyring", "readwrite");
      const store = tx.objectStore("keyring");
      store.put(JSON.stringify(keyring), scopedKey);
      tx.oncomplete = () => db.close();
    };
  } catch (e) {
    console.error("Failed to save keyring to IndexedDB", e);
  }
}

function saveSharedKeysToIndexedDB(sharedKeyring: SharedKeyring) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const scopedKey = getScopedKey("eclipse:e2e:sharedKeyringData");
  const generation = importedKeyGeneration;
  try {
    const request = indexedDB.open("EclipseE2EKeys", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keyring")) {
        db.createObjectStore("keyring");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (generation !== importedKeyGeneration) { db.close(); return; }
      const tx = db.transaction("keyring", "readwrite");
      const store = tx.objectStore("keyring");
      store.put(JSON.stringify(sharedKeyring), scopedKey);
      tx.oncomplete = () => db.close();
    };
  } catch (e) {
    console.error("Failed to save shared keyring to IndexedDB", e);
  }
}

function clearKeyringInIndexedDB() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const scopedKeys = [getScopedKey("eclipse:e2e:keyringData"), getScopedKey("eclipse:e2e:sharedKeyringData"), "keyringData", "sharedKeyringData"];
  try {
    const request = indexedDB.open("EclipseE2EKeys", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keyring")) {
        db.createObjectStore("keyring");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("keyring", "readwrite");
      const store = tx.objectStore("keyring");
      scopedKeys.forEach(key => store.delete(key));
      tx.oncomplete = () => db.close();
    };
  } catch (e) {
    console.error("Failed to clear keyring in IndexedDB", e);
  }
}

function hydrateKeyringIfNeeded() {
  if (keyringHydrated) return;
  keyringHydrated = true;
  const raw = safeGetStorage(KEYRING_STORAGE_V2) ?? safeGetStorage(KEYRING_STORAGE);
  if (!raw) {
    memoryKeyring = { activePublicKeyBase64: null, keys: [] };
    return;
  }
  try {
    memoryKeyring = normalizeKeyring(JSON.parse(raw));
    safeSetStorage(KEYRING_STORAGE_V2, JSON.stringify(memoryKeyring));
    saveKeyringToIndexedDB(memoryKeyring);
  } catch {
    memoryKeyring = { activePublicKeyBase64: null, keys: [] };
  }
}

function readKeyring(): E2EKeyring {
  hydrateKeyringIfNeeded();
  return memoryKeyring;
}

function writeKeyring(keyring: E2EKeyring) {
  memoryKeyring = keyring;
  safeSetStorage(KEYRING_STORAGE_V2, JSON.stringify(keyring));
  saveKeyringToIndexedDB(keyring);
}

function upsertKeyringPair(input: { publicKeyBase64: string; privateKeyBase64: string; makeActive?: boolean }) {
  const keyring = readKeyring();
  const existing = keyring.keys.find((k) => k.publicKeyBase64 === input.publicKeyBase64);
  if (existing) {
    existing.privateKeyBase64 = input.privateKeyBase64;
  } else {
    keyring.keys.unshift({
      publicKeyBase64: input.publicKeyBase64,
      privateKeyBase64: input.privateKeyBase64,
      createdAt: Date.now(),
    });
  }
  if (input.makeActive) {
    keyring.activePublicKeyBase64 = input.publicKeyBase64;
  }
  writeKeyring(keyring);
  return keyring;
}

export function loadStoredE2EKeyPairs() {
  const keyring = readKeyring();
  if (keyring.keys.length) {
    return keyring.keys;
  }
  return [];
}

let activeUserId: string | null = null;

export function setActiveE2EUserId(userId: string | null) {
  if (activeUserId !== userId) {
    importedKeyGeneration += 1;
    memoryPrivateKeyBase64 = null;
    memoryPublicKeyBase64 = null;
    memoryKeyring = { activePublicKeyBase64: null, keys: [] };
    memorySharedKeyring = {};
    keyringHydrated = false;
    sharedKeyringHydrated = false;
    importedPublicKeyCache.clear();
    importedPrivateKeyCache.clear();
    importedSharedKeyCache.clear();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("eclipse:e2e-scope-changed"));
  }
  activeUserId = userId;
  if (typeof window !== "undefined") {
    if (userId) {
      localStorage.setItem("eclipse:active-user-id", userId);
    } else {
      localStorage.removeItem("eclipse:active-user-id");
    }
  }
}

function getScopedKey(key: string): string {
  if (typeof window === "undefined") return key;
  if (!key.startsWith("eclipse:e2e:")) return key;
  const id = activeUserId || localStorage.getItem("eclipse:active-user-id");
  return id ? `${key}:${id}` : key;
}

function safeGetStorage(key: string) {
  try {
    const scopedKey = getScopedKey(key);
    let value = localStorage.getItem(scopedKey);
    if (value === null && scopedKey !== key) {
      const legacyOwner = localStorage.getItem(E2E_OWNER_USER_ID_STORAGE);
      const currentOwner = activeUserId || localStorage.getItem("eclipse:active-user-id");
      if (legacyOwner && legacyOwner !== currentOwner) return null;
      const legacyValue = localStorage.getItem(key);
      if (legacyValue !== null) {
        localStorage.setItem(scopedKey, legacyValue);
        value = legacyValue;
      }
    }
    return value;
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(getScopedKey(key), value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveStorage(key: string) {
  try {
    localStorage.removeItem(getScopedKey(key));
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeGetSessionStorage(key: string) {
  try {
    const scopedKey = getScopedKey(key);
    let value = sessionStorage.getItem(scopedKey);
    if (value === null && scopedKey !== key) {
      const legacyValue = sessionStorage.getItem(key);
      if (legacyValue !== null) {
        sessionStorage.setItem(scopedKey, legacyValue);
        value = legacyValue;
      }
    }
    return value;
  } catch {
    return null;
  }
}

function safeSetSessionStorage(key: string, value: string) {
  try {
    sessionStorage.setItem(getScopedKey(key), value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveSessionStorage(key: string) {
  try {
    sessionStorage.removeItem(getScopedKey(key));
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadBackupSecret() {
  return safeGetStorage(BACKUP_SECRET_STORAGE);
}

export function ensureBackupSecret() {
  const existing = loadBackupSecret();
  if (existing) {
    return { secret: existing, created: false };
  }
  if (!crypto?.getRandomValues) {
    throw new Error("WebCrypto недоступен в этом окружении");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = toBase64(bytes);
  safeSetStorage(BACKUP_SECRET_STORAGE, secret);
  return { secret, created: true };
}

export function storeBackupSecret(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) return false;
  return safeSetStorage(BACKUP_SECRET_STORAGE, trimmed);
}

export function clearBackupSecret() {
  safeRemoveStorage(BACKUP_SECRET_STORAGE);
}

function readStoredBase64Pair() {
  const privateBase64 = safeGetStorage(PRIVATE_KEY_STORAGE);
  const publicBase64 = safeGetStorage(PUBLIC_KEY_STORAGE);
  if (privateBase64 && publicBase64) {
    return { privateBase64, publicBase64 };
  }

  const legacyPrivate = safeGetStorage(LEGACY_PRIVATE_KEY_STORAGE);
  const legacyPublic = safeGetStorage(LEGACY_PUBLIC_KEY_STORAGE);
  if (legacyPrivate && legacyPublic) {
    return { privateBase64: legacyPrivate, publicBase64: legacyPublic };
  }

  return null;
}

export function loadLegacyLocalE2EKeyPairs() {
  const rawKeyring = safeGetStorage(KEYRING_STORAGE);
  if (rawKeyring) {
    try {
      const parsed = JSON.parse(rawKeyring) as E2EKeyring;
      if (parsed && Array.isArray(parsed.keys)) {
        return parsed.keys
          .filter((k) => k?.publicKeyBase64 && k?.privateKeyBase64)
          .map((k) => ({
            publicKeyBase64: k.publicKeyBase64,
            privateKeyBase64: k.privateKeyBase64,
            createdAt: typeof k.createdAt === "number" ? k.createdAt : Date.now(),
            isActive: parsed.activePublicKeyBase64 === k.publicKeyBase64,
          }));
      }
    } catch {
      // ignore
    }
  }
  const pair = readStoredBase64Pair();
  if (pair) {
    return [{
      publicKeyBase64: pair.publicBase64,
      privateKeyBase64: pair.privateBase64,
      createdAt: Date.now(),
      isActive: true,
    }];
  }
  return [];
}

export function clearLegacyLocalE2EStorage() {
  safeRemoveStorage(PRIVATE_KEY_STORAGE);
  safeRemoveStorage(PUBLIC_KEY_STORAGE);
  safeRemoveStorage(KEYRING_STORAGE);
  safeRemoveStorage(LEGACY_PRIVATE_KEY_STORAGE);
  safeRemoveStorage(LEGACY_PUBLIC_KEY_STORAGE);
}

export function loadE2EOwnerUserId() {
  return safeGetStorage(E2E_OWNER_USER_ID_STORAGE);
}

export function storeE2EOwnerUserId(userId: string) {
  const trimmed = userId.trim();
  if (!trimmed) return false;
  return safeSetStorage(E2E_OWNER_USER_ID_STORAGE, trimmed);
}

export function clearLocalE2EIdentity() {
  importedKeyGeneration += 1;
  memoryPrivateKeyBase64 = null;
  memoryPublicKeyBase64 = null;
  memoryKeyring = { activePublicKeyBase64: null, keys: [] };
  memorySharedKeyring = {};
  keyringHydrated = false;
  sharedKeyringHydrated = false;
  importedPublicKeyCache.clear();
  importedPrivateKeyCache.clear();
  importedSharedKeyCache.clear();

  safeRemoveStorage(KEYRING_STORAGE_V2);
  safeRemoveStorage(KEYRING_STORAGE);
  safeRemoveStorage(SHARED_KEYRING_STORAGE_V2);
  safeRemoveStorage(SHARED_KEYRING_STORAGE);
  safeRemoveStorage(PRIVATE_KEY_STORAGE);
  safeRemoveStorage(PUBLIC_KEY_STORAGE);
  safeRemoveStorage(PASSWORD_MASTER_KEY_STORAGE);
  safeRemoveStorage(BACKUP_SECRET_STORAGE);
  safeRemoveStorage(E2E_OWNER_USER_ID_STORAGE);
  safeRemoveStorage(LEGACY_PRIVATE_KEY_STORAGE);
  safeRemoveStorage(LEGACY_PUBLIC_KEY_STORAGE);
  clearLegacyLocalE2EStorage();
  clearPendingPassword();
  safeRemoveSessionStorage(E2E_SYNC_MARKER_SESSION_KEY);
  clearKeyringInIndexedDB();
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  if (typeof value !== "string" || !value) return new Uint8Array(0);
  if (value === "null" || value === "undefined") return new Uint8Array(0);

  // Remove whitespace and newlines
  let cleaned = value.replace(/\s+/g, "");

  // Convert URL-safe base64 to standard base64
  cleaned = cleaned.replace(/-/g, "+").replace(/_/g, "/");

  // Clean invalid base64 characters
  cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, "");

  // Add missing padding if needed
  const padLength = (4 - (cleaned.length % 4)) % 4;
  if (padLength > 0 && padLength < 4) {
    cleaned += "=".repeat(padLength);
  }

  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error("fromBase64 failed decoding:", value, err);
    return new Uint8Array(0);
  }
}

function decodeBackupPayload(payloadBase64: string) {
  try {
    return new TextDecoder().decode(fromBase64(payloadBase64));
  } catch {
    return null;
  }
}

function getBackupPayloadPrefix(payloadBase64: string) {
  const decoded = decodeBackupPayload(payloadBase64);
  if (!decoded) return null;
  if (decoded.startsWith(LEGACY_BACKUP_WRAPPER_PREFIX)) return "legacy";
  if (decoded.startsWith(PASSWORD_BACKUP_WRAPPER_PREFIX)) return "password";
  return null;
}

function isWrappedBackupPayload(payloadBase64: string) {
  try {
    return Boolean(getBackupPayloadPrefix(payloadBase64));
  } catch {
    return false;
  }
}

async function importBackupSecretKey(secretBase64: string) {
  const raw = fromBase64(secretBase64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function wrapPrivateKeyForBackup(privateKeyBase64: string, secretBase64?: string) {
  if (!crypto?.subtle) {
    throw new Error("WebCrypto недоступен в этом окружении");
  }
  const secret = secretBase64 ?? ensureBackupSecret().secret;
  const key = await importBackupSecretKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(privateKeyBase64);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);
  const payload = `${LEGACY_BACKUP_WRAPPER_PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(cipherBuffer))}`;
  return toBase64(new TextEncoder().encode(payload));
}

export async function unwrapPrivateKeyFromBackup(payloadBase64: string, secretBase64: string) {
  if (getBackupPayloadPrefix(payloadBase64) !== "legacy") {
    return payloadBase64;
  }
  const text = decodeBackupPayload(payloadBase64);
  if (!text || !text.startsWith(LEGACY_BACKUP_WRAPPER_PREFIX)) {
    throw new Error("Invalid backup payload");
  }
  const data = text.slice(LEGACY_BACKUP_WRAPPER_PREFIX.length);
  const [ivB64, cipherB64] = data.split(".");
  if (!ivB64 || !cipherB64) {
    throw new Error("Invalid backup payload");
  }
  const key = await importBackupSecretKey(secretBase64);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivB64) },
    key,
    fromBase64(cipherB64),
  );
  return new TextDecoder().decode(plainBuffer);
}

export function isBackupPayloadWrapped(payloadBase64: string) {
  return isWrappedBackupPayload(payloadBase64);
}

export function isPasswordBackupPayload(payloadBase64: string) {
  return getBackupPayloadPrefix(payloadBase64) === "password";
}

export async function derivePasswordMasterKeyBase64(password: string, userId: string) {
  if (!crypto?.subtle) {
    throw new Error("WebCrypto is unavailable");
  }
  const salt = new TextEncoder().encode(`eclipse:e2e:${userId}`);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PASSWORD_DERIVATION_ITERATIONS, hash: "SHA-256" },
    baseKey,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export function storePasswordMasterKey(masterKeyBase64: string) {
  safeSetStorage(PASSWORD_MASTER_KEY_STORAGE, masterKeyBase64);
}

export function loadPasswordMasterKey() {
  return safeGetStorage(PASSWORD_MASTER_KEY_STORAGE);
}

export function clearPasswordMasterKey() {
  safeRemoveStorage(PASSWORD_MASTER_KEY_STORAGE);
}

export function storePendingPassword(password: string) {
  if (!password) return false;
  return safeSetSessionStorage(PASSWORD_PENDING_STORAGE, password);
}

export function consumePendingPassword() {
  const value = safeGetSessionStorage(PASSWORD_PENDING_STORAGE);
  safeRemoveSessionStorage(PASSWORD_PENDING_STORAGE);
  return value;
}

export function clearPendingPassword() {
  safeRemoveSessionStorage(PASSWORD_PENDING_STORAGE);
}

async function importPasswordMasterKey(masterKeyBase64: string) {
  return crypto.subtle.importKey("raw", fromBase64(masterKeyBase64), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function wrapPrivateKeyWithPassword(privateKeyBase64: string, masterKeyBase64: string) {
  if (!crypto?.subtle) {
    throw new Error("WebCrypto is unavailable");
  }
  const key = await importPasswordMasterKey(masterKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(privateKeyBase64);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);
  const payload = `${PASSWORD_BACKUP_WRAPPER_PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(cipherBuffer))}`;
  return toBase64(new TextEncoder().encode(payload));
}

export async function unwrapPrivateKeyWithPassword(payloadBase64: string, masterKeyBase64: string) {
  if (getBackupPayloadPrefix(payloadBase64) !== "password") {
    return payloadBase64;
  }
  const text = decodeBackupPayload(payloadBase64);
  if (!text || !text.startsWith(PASSWORD_BACKUP_WRAPPER_PREFIX)) {
    throw new Error("Invalid password backup payload");
  }
  const data = text.slice(PASSWORD_BACKUP_WRAPPER_PREFIX.length);
  const [ivB64, cipherB64] = data.split(".");
  if (!ivB64 || !cipherB64) {
    throw new Error("Invalid password backup payload");
  }
  const key = await importPasswordMasterKey(masterKeyBase64);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivB64) },
    key,
    fromBase64(cipherB64),
  );
  return new TextDecoder().decode(plainBuffer);
}

async function exportPublicKeyBase64(key: CryptoKey) {
  const raw = await crypto.subtle.exportKey("spki", key);
  return toBase64(new Uint8Array(raw));
}

async function exportPrivateKeyBase64(key: CryptoKey) {
  const raw = await crypto.subtle.exportKey("pkcs8", key);
  return toBase64(new Uint8Array(raw));
}

async function importPublicKey(base64: string) {
  const cached = importedPublicKeyCache.get(base64);
  if (cached) {
    return cached;
  }
  const imported = await crypto.subtle.importKey(
    "spki",
    fromBase64(base64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
  if (importedPublicKeyCache.size > 256) {
    importedPublicKeyCache.clear();
  }
  importedPublicKeyCache.set(base64, imported);
  return imported;
}

async function importPrivateKey(base64: string) {
  const cached = importedPrivateKeyCache.get(base64);
  if (cached) return cached;
  const generation = importedKeyGeneration;
  const imported = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(base64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
  if (generation === importedKeyGeneration) importedPrivateKeyCache.set(base64, imported);
  return imported;
}

export type E2EIdentity = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  privateKeyBase64: string;
  publicKeyBase64: string;
};

export async function loadStoredE2EIdentity(): Promise<E2EIdentity | null> {
  const generation = importedKeyGeneration;
  if (!crypto?.subtle) {
    throw new Error("WebCrypto недоступен в этом окружении");
  }

  const keyring = readKeyring();
  let activePublic = keyring.activePublicKeyBase64 ?? memoryPublicKeyBase64;
  if (!activePublic && keyring.keys.length > 0) {
    activePublic = keyring.keys[0].publicKeyBase64;
    keyring.activePublicKeyBase64 = activePublic;
    writeKeyring(keyring);
  }
  const activePair = keyring.keys.find((k) => k.publicKeyBase64 === activePublic) ?? null;
  const existingPrivate = activePair?.privateKeyBase64 ?? memoryPrivateKeyBase64;
  const existingPublic = activePair?.publicKeyBase64 ?? memoryPublicKeyBase64;
  if (!existingPrivate || !existingPublic) {
    return null;
  }

  try {
    const privateKey = await importPrivateKey(existingPrivate);
    const publicKey = await importPublicKey(existingPublic);
    if (generation !== importedKeyGeneration) return null;
    memoryPrivateKeyBase64 = existingPrivate;
    memoryPublicKeyBase64 = existingPublic;
    return {
      privateKey,
      publicKey,
      privateKeyBase64: existingPrivate,
      publicKeyBase64: existingPublic,
    };
  } catch {
    memoryPrivateKeyBase64 = null;
    memoryPublicKeyBase64 = null;
    return null;
  }
}

export async function storeE2EIdentityFromBase64(input: {
  privateKeyBase64: string;
  publicKeyBase64: string;
}): Promise<E2EIdentity> {
  const generation = importedKeyGeneration;
  if (!crypto?.subtle) {
    throw new Error("WebCrypto недоступен в этом окружении");
  }

  const privateKey = await importPrivateKey(input.privateKeyBase64);
  const publicKey = await importPublicKey(input.publicKeyBase64);
  if (generation !== importedKeyGeneration) throw new Error("Аккаунт изменился во время восстановления ключей");

  upsertKeyringPair({ publicKeyBase64: input.publicKeyBase64, privateKeyBase64: input.privateKeyBase64, makeActive: true });

  memoryPrivateKeyBase64 = input.privateKeyBase64;
  memoryPublicKeyBase64 = input.publicKeyBase64;

  return {
    privateKey,
    publicKey,
    privateKeyBase64: input.privateKeyBase64,
    publicKeyBase64: input.publicKeyBase64,
  };
}

export type E2EBackupRecord = { publicKey: string; privateKey: string; isActive?: boolean };

// Restore historical keys too: old DMs and shared group/channel keys still use them.
// A readable historical backup must never replace an unreadable active identity.
export async function restoreE2EKeyringFromBackups(
  backups: E2EBackupRecord[], expectedPublicKey: string | null,
  master = loadPasswordMasterKey(),
): Promise<E2EIdentity | null> {
  const generation = importedKeyGeneration;
  const backupSecret = loadBackupSecret();
  const activePublic = expectedPublicKey ?? backups.find(b => b.isActive)?.publicKey ?? null;
  for (const backup of backups) {
    let decoded: string | null = null;
    try {
      decoded = isPasswordBackupPayload(backup.privateKey)
        ? master ? await unwrapPrivateKeyWithPassword(backup.privateKey, master) : null
        : isBackupPayloadWrapped(backup.privateKey)
          ? backupSecret ? await unwrapPrivateKeyFromBackup(backup.privateKey, backupSecret) : null
          : backup.privateKey;
      if (!decoded || !await validateE2EKeyPairBase64({ publicKeyBase64: backup.publicKey, privateKeyBase64: decoded })) continue;
    } catch { continue; } // An unreadable historical key must not hide other valid backups.
    if (generation !== importedKeyGeneration) throw new Error("Account changed during key recovery");
    upsertKeyringPair({ publicKeyBase64: backup.publicKey, privateKeyBase64: decoded, makeActive: backup.publicKey === activePublic });
  }
  if (generation !== importedKeyGeneration) throw new Error("Account changed during key recovery");
  const active = loadStoredE2EKeyPairs().find(pair => pair.publicKeyBase64 === activePublic);
  return active ? storeE2EIdentityFromBase64(active) : null;
}

export async function restoreE2EIdentityFromBackup(masterKeyBase64?: string): Promise<E2EIdentity | null> {
  const generation = importedKeyGeneration;
  const [response, key] = await Promise.all([
    apiRequest<{ backup: E2EBackupRecord | null; backups?: E2EBackupRecord[] }>("/api/settings/e2e-key/backup", { method: "GET" }),
    apiRequest<{ publicKey: string | null }>("/api/settings/e2e-key", { method: "GET" }),
  ]);
  if (generation !== importedKeyGeneration) throw new Error("Account changed during key recovery");
  const backups = response.backups?.length ? response.backups : response.backup ? [{ ...response.backup, isActive: true }] : [];
  return restoreE2EKeyringFromBackups(backups, key.publicKey, masterKeyBase64);
}

// Detached generation is used by registration so adding account B cannot reuse A's keys.
export async function createE2EIdentity(): Promise<E2EIdentity> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"],
  );
  return {
    ...pair,
    privateKeyBase64: await exportPrivateKeyBase64(pair.privateKey),
    publicKeyBase64: await exportPublicKeyBase64(pair.publicKey),
  };
}

export function storeRegistrationE2EIdentity(userId: string, identity: E2EIdentity) {
  // Persist before verification/navigation without switching the currently signed-in account.
  localStorage.setItem(`${KEYRING_STORAGE_V2}:${userId}`, JSON.stringify({
    activePublicKeyBase64: identity.publicKeyBase64,
    keys: [{ publicKeyBase64: identity.publicKeyBase64, privateKeyBase64: identity.privateKeyBase64, createdAt: Date.now() }],
  }));
}

export async function ensureE2EIdentity(options?: { restoreFromServer?: boolean }): Promise<E2EIdentity> {
  if (options?.restoreFromServer !== false) {
    // Centralized recovery rejects locked/missing backups instead of silently rotating keys.
    const { resolveE2EIdentity } = await import("@/lib/client/e2e-identity");
    return resolveE2EIdentity();
  }
  const generation = importedKeyGeneration;
  const existing = await loadStoredE2EIdentity();
  if (existing) return existing;
  const identity = await createE2EIdentity();
  if (generation !== importedKeyGeneration) throw new Error("Account changed during key creation");
  return storeE2EIdentityFromBase64(identity);
}

// Async operations capture this token so another account cannot receive their result.
export function getE2EScopeGeneration() { return importedKeyGeneration; }

type EncryptInput = {
  plainText: string;
  senderPublicKeyBase64: string;
  recipientPublicKeyBase64: string;
  context?: string;
};

export async function encryptMessageForUsers(input: EncryptInput) {
  const senderPublicKey = await importPublicKey(input.senderPublicKeyBase64);
  const recipientPublicKey = await importPublicKey(input.recipientPublicKeyBase64);
  const contentKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(input.plainText);
  const contextBytes = input.context ? new TextEncoder().encode(input.context) : undefined;

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, ...(contextBytes ? { additionalData: contextBytes } : {}) },
    contentKey,
    plainBytes,
  );
  const rawContentKey = await crypto.subtle.exportKey("raw", contentKey);
  const encryptedKeyForSender = await crypto.subtle.encrypt(
    { name: "RSA-OAEP", ...(contextBytes ? { label: contextBytes } : {}) },
    senderPublicKey,
    rawContentKey,
  );
  const encryptedKeyForRecipient = await crypto.subtle.encrypt(
    { name: "RSA-OAEP", ...(contextBytes ? { label: contextBytes } : {}) },
    recipientPublicKey,
    rawContentKey,
  );

  return {
    cipherText: toBase64(new Uint8Array(cipherBuffer)),
    iv: toBase64(iv),
    encryptedKeyForSender: toBase64(new Uint8Array(encryptedKeyForSender)),
    encryptedKeyForRecipient: toBase64(new Uint8Array(encryptedKeyForRecipient)),
  };
}

export async function decryptMessageWithPrivateKey(params: {
  privateKey: CryptoKey;
  cipherText: string;
  iv: string;
  encryptedKey: string;
  context?: string;
}) {
  const contextBytes = params.context ? new TextEncoder().encode(params.context) : undefined;
  const rawContentKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP", ...(contextBytes ? { label: contextBytes } : {}) },
    params.privateKey,
    fromBase64(params.encryptedKey),
  );
  const contentKey = await crypto.subtle.importKey(
    "raw",
    rawContentKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(params.iv), ...(contextBytes ? { additionalData: contextBytes } : {}) },
    contentKey,
    fromBase64(params.cipherText),
  );
  return new TextDecoder().decode(plainBuffer);
}


export async function decryptMessageWithPrivateKeyBase64(params: {
  privateKeyBase64: string;
  cipherText: string;
  iv: string;
  encryptedKey: string;
}) {
  const privateKey = await importPrivateKey(params.privateKeyBase64);
  return decryptMessageWithPrivateKey({
    privateKey,
    cipherText: params.cipherText,
    iv: params.iv,
    encryptedKey: params.encryptedKey,
  });
}

export async function validateE2EKeyPairBase64(input: {
  publicKeyBase64: string;
  privateKeyBase64: string;
}) {
  if (!crypto?.subtle) return false;
  try {
    const publicKey = await importPublicKey(input.publicKeyBase64);
    const privateKey = await importPrivateKey(input.privateKeyBase64);
    const probe = crypto.getRandomValues(new Uint8Array(32));
    const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, probe);
    const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encrypted);
    const decoded = new Uint8Array(decrypted);
    if (decoded.length !== probe.length) return false;
    for (let i = 0; i < probe.length; i += 1) {
      if (decoded[i] !== probe[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function storeE2EKeyPairToKeyring(input: { publicKeyBase64: string; privateKeyBase64: string; makeActive?: boolean }) {
  upsertKeyringPair({
    publicKeyBase64: input.publicKeyBase64,
    privateKeyBase64: input.privateKeyBase64,
    makeActive: Boolean(input.makeActive),
  });
}

const SHARED_KEYRING_STORAGE = "eclipse:e2e:shared-keys:v1";
const SHARED_KEYRING_STORAGE_V2 = "eclipse:e2e:shared-keys:v2";

type SharedChatKey = {
  version: number;
  keyBase64: string;
  createdAt: number;
};

type SharedKeyring = Record<string, { activeVersion: number | null; keys: SharedChatKey[] }>;
let memorySharedKeyring: SharedKeyring = {};
let sharedKeyringHydrated = false;

function normalizeSharedKeyring(raw: unknown): SharedKeyring {
  if (!raw || typeof raw !== "object") return {};
  const result: SharedKeyring = {};
  const source = raw as Record<string, unknown>;
  for (const [chatKey, entry] of Object.entries(source)) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as { activeVersion?: unknown; keys?: unknown };
    const keys = Array.isArray(obj.keys)
      ? obj.keys
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof (item as { version?: unknown }).version === "number" &&
              typeof (item as { keyBase64?: unknown }).keyBase64 === "string",
          )
          .map((item) => ({
            version: (item as { version: number }).version,
            keyBase64: (item as { keyBase64: string }).keyBase64,
            createdAt:
              typeof (item as { createdAt?: unknown }).createdAt === "number"
                ? (item as { createdAt: number }).createdAt
                : Date.now(),
          }))
      : [];
    result[chatKey] = {
      activeVersion: typeof obj.activeVersion === "number" ? obj.activeVersion : null,
      keys,
    };
  }
  return result;
}

function hydrateSharedKeyringIfNeeded() {
  if (sharedKeyringHydrated) return;
  sharedKeyringHydrated = true;
  const raw = safeGetStorage(SHARED_KEYRING_STORAGE_V2) ?? safeGetStorage(SHARED_KEYRING_STORAGE);
  if (!raw) {
    memorySharedKeyring = {};
    return;
  }
  try {
    memorySharedKeyring = normalizeSharedKeyring(JSON.parse(raw));
    safeSetStorage(SHARED_KEYRING_STORAGE_V2, JSON.stringify(memorySharedKeyring));
    saveSharedKeysToIndexedDB(memorySharedKeyring);
  } catch {
    memorySharedKeyring = {};
  }
}

function readSharedKeyring(): SharedKeyring {
  hydrateSharedKeyringIfNeeded();
  return memorySharedKeyring;
}

function writeSharedKeyring(next: SharedKeyring) {
  memorySharedKeyring = next;
  safeSetStorage(SHARED_KEYRING_STORAGE_V2, JSON.stringify(next));
  saveSharedKeysToIndexedDB(next);
}

export function loadSharedChatKeys(chatKey: string) {
  const ring = readSharedKeyring();
  const entry = ring[chatKey];
  if (!entry?.keys?.length) return [];
  return entry.keys;
}

export function loadActiveSharedChatKey(chatKey: string) {
  const ring = readSharedKeyring();
  const entry = ring[chatKey];
  if (!entry?.keys?.length || !entry.activeVersion) return null;
  return entry.keys.find((k) => k.version === entry.activeVersion) ?? null;
}

export function storeSharedChatKey(chatKey: string, key: SharedChatKey, makeActive = false) {
  const ring = readSharedKeyring();
  const existing = ring[chatKey] ?? { activeVersion: null, keys: [] };
  const found = existing.keys.find((k) => k.version === key.version);
  if (found) {
    found.keyBase64 = key.keyBase64;
    found.createdAt = key.createdAt;
  } else {
    existing.keys.unshift(key);
  }
  if (makeActive) {
    existing.activeVersion = key.version;
  }
  ring[chatKey] = existing;
  writeSharedKeyring(ring);
}

export function markSharedChatKeyActive(chatKey: string, version: number) {
  const ring = readSharedKeyring();
  const entry = ring[chatKey];
  if (!entry) return;
  entry.activeVersion = version;
  ring[chatKey] = entry;
  writeSharedKeyring(ring);
}

export async function generateSharedKeyBase64() {
  if (!crypto?.getRandomValues) {
    throw new Error("WebCrypto недоступен");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes);
}

async function importSharedKey(keyBase64: string) {
  const cached = importedSharedKeyCache.get(keyBase64);
  if (cached) return cached;
  const generation = importedKeyGeneration;
  const raw = fromBase64(keyBase64);
  const imported = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  if (generation === importedKeyGeneration) importedSharedKeyCache.set(keyBase64, imported);
  return imported;
}

export async function encryptWithSharedKey(params: { plainText: string; keyBase64: string }) {
  const key = await importSharedKey(params.keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(params.plainText);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);
  return {
    cipherText: toBase64(new Uint8Array(cipherBuffer)),
    iv: toBase64(iv),
  };
}

export async function decryptWithSharedKey(params: { cipherText: string; iv: string; keyBase64: string }) {
  const key = await importSharedKey(params.keyBase64);
  const iv = fromBase64(params.iv);
  const cipherBytes = fromBase64(params.cipherText);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuffer);
}

export async function encryptSharedKeyForUser(input: { sharedKeyBase64: string; recipientPublicKeyBase64: string }) {
  const publicKey = await importPublicKey(input.recipientPublicKeyBase64);
  const raw = fromBase64(input.sharedKeyBase64);
  const encryptedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, raw);
  return toBase64(new Uint8Array(encryptedKey));
}

export async function decryptSharedKeyWithPrivateKeyBase64(input: {
  encryptedKeyBase64: string;
  privateKeyBase64: string;
}) {
  const privateKey = await importPrivateKey(input.privateKeyBase64);
  const encrypted = fromBase64(input.encryptedKeyBase64);
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encrypted);
  return toBase64(new Uint8Array(raw));
}

export async function decryptSharedKeyWithKeyring(encryptedKeyBase64: string): Promise<string> {
  const keyring = readKeyring();
  const identity = await loadStoredE2EIdentity();

  const candidates: string[] = [];
  if (identity?.privateKeyBase64) {
    candidates.push(identity.privateKeyBase64);
  }
  for (const k of keyring.keys) {
    if (k.privateKeyBase64 && !candidates.includes(k.privateKeyBase64)) {
      candidates.push(k.privateKeyBase64);
    }
  }

  let lastError: unknown = null;
  for (const privateKeyBase64 of candidates) {
    try {
      return await decryptSharedKeyWithPrivateKeyBase64({
        encryptedKeyBase64,
        privateKeyBase64,
      });
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error("Failed to decrypt shared key with any available private key");
}

export async function decryptMessageWithKeyring(params: {
  cipherText: string;
  iv: string;
  encryptedKey: string;
}): Promise<string> {
  const keyring = readKeyring();
  const identity = await loadStoredE2EIdentity();

  const candidates: string[] = [];
  if (identity?.privateKeyBase64) {
    candidates.push(identity.privateKeyBase64);
  }
  for (const k of keyring.keys) {
    if (k.privateKeyBase64 && !candidates.includes(k.privateKeyBase64)) {
      candidates.push(k.privateKeyBase64);
    }
  }

  let lastError: unknown = null;
  for (const privateKeyBase64 of candidates) {
    try {
      return await decryptMessageWithPrivateKeyBase64({
        privateKeyBase64,
        cipherText: params.cipherText,
        iv: params.iv,
        encryptedKey: params.encryptedKey,
      });
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error("Failed to decrypt message with any available private key");
}
