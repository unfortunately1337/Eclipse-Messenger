"use client";

import { decryptMessageWithPrivateKey } from "./e2e";

type DeviceKey = {
  id: string; ownerId: string; publicKeyBase64: string; privateKey: CryptoKey;
  chatId?: string; peerPublicKey?: string; expiresAt: number;
};
export type SecretCrypto = { version: number; ownKeyId: string | null; ownPublicKey: string | null };
const PREFIX = "secret:v2:";
let generation = 0;
if (typeof window !== "undefined") {
  window.addEventListener("eclipse:e2e-scope-changed", () => { generation += 1; });
  const prune = () => { void deleteSecretDeviceKeys(null).catch(() => {}); };
  window.addEventListener("pageshow", prune);
  window.setInterval(prune, 30_000);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Для секретного чата необходимо локальное хранилище ключей"));
    const request = indexedDB.open("EclipseSecretDeviceKeys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read(id: string, ownerId: string): Promise<DeviceKey> {
  const epoch = generation;
  const db = await openDatabase();
  try {
    const record = await new Promise<DeviceKey | undefined>((resolve, reject) => {
      const request = db.transaction("keys").objectStore("keys").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (epoch !== generation || !record || record.ownerId !== ownerId || record.expiresAt <= Date.now()) {
      throw new Error("Ключ секретного чата недоступен на этом устройстве. Создайте новый секретный чат");
    }
    return record;
  } finally { db.close(); }
}

async function save(record: DeviceKey, enforcePin = false) {
  const epoch = generation;
  const db = await openDatabase();
  try {
    if (epoch !== generation) throw new Error("Аккаунт изменился во время сохранения ключа");
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keys", "readwrite");
      const store = tx.objectStore("keys");
      if (enforcePin) {
        // Recheck the pin within the write transaction: two tabs must not
        // both observe an empty pin and overwrite each other's decision.
        const request = store.get(record.id);
        request.onsuccess = () => {
          const existing = request.result as DeviceKey | undefined;
          if (epoch !== generation || !existing || existing.expiresAt <= Date.now() || existing.ownerId !== record.ownerId ||
              existing.publicKeyBase64 !== record.publicKeyBase64 ||
              (existing.chatId && existing.chatId !== record.chatId) ||
              (existing.peerPublicKey && existing.peerPublicKey !== record.peerPublicKey)) {
            tx.abort();
            return;
          }
          store.put({ ...record, expiresAt: Math.min(existing.expiresAt, record.expiresAt) });
        };
      } else { store.put(record); }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function createSecretDeviceKey(ownerId: string) {
  if (!ownerId) throw new Error("Не удалось определить аккаунт");
  const epoch = generation;
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    false, ["encrypt", "decrypt"],
  );
  const bytes = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const publicKeyBase64 = btoa(String.fromCharCode(...bytes));
  if (epoch !== generation) throw new Error("Аккаунт изменился во время создания ключа");
  const record: DeviceKey = {
    id: crypto.randomUUID(), ownerId, publicKeyBase64, privateKey: pair.privateKey,
    expiresAt: Date.now() + 31 * 86400_000,
  };
  await save(record);
  return { deviceKeyId: record.id, devicePublicKey: publicKeyBase64 };
}

export async function bindSecretDeviceKey(ownerId: string, chatId: string, info: SecretCrypto, peerKey: string | null, expiresAt?: string | null) {
  if (info.version !== 2) return;
  if (!info.ownKeyId || !info.ownPublicKey) throw new Error("Ключ устройства не зарегистрирован");
  const record = await read(info.ownKeyId, ownerId);
  if (record.publicKeyBase64 !== info.ownPublicKey || (record.chatId && record.chatId !== chatId)) {
    throw new Error("Ключ секретного чата изменился. Создайте новый чат и сравните код защиты");
  }
  if (record.peerPublicKey && peerKey && record.peerPublicKey !== peerKey) {
    throw new Error("Ключ собеседника изменился. Отправка в этот секретный чат заблокирована");
  }
  const deadline = expiresAt ? Date.parse(expiresAt) : record.expiresAt;
  if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error("Секретный чат истёк");
  // A refresh may shorten the lifetime, but cannot restore a previously
  // expired identity or extend an already established local deadline.
  await save({ ...record, chatId, peerPublicKey: peerKey ?? record.peerPublicKey, expiresAt: Math.min(record.expiresAt, deadline) }, true);
}

export async function loadSecretDeviceIdentity(ownerId: string, info: SecretCrypto) {
  if (info.version !== 2 || !info.ownKeyId) throw new Error("Ключ секретного чата не зарегистрирован");
  const record = await read(info.ownKeyId, ownerId);
  if (info.ownPublicKey !== record.publicKeyBase64) throw new Error("Ключ секретного чата изменился");
  return { privateKey: record.privateKey, publicKeyBase64: record.publicKeyBase64 };
}

export function isSecretDeviceEnvelope(encryptedKey: string) { return encryptedKey.startsWith(PREFIX); }
export function secretEncryptionContext(chatId: string) { return `eclipse-secret-v2:${chatId}`; }
export async function decryptSecretDeviceMessage(ownerId: string, params: { cipherText: string; iv: string; encryptedKey: string }) {
  const parts = params.encryptedKey.slice(PREFIX.length).split(":");
  if (!isSecretDeviceEnvelope(params.encryptedKey) || parts.length !== 2 || !/^[0-9a-f-]{36}$/.test(parts[0])) throw new Error("Некорректный конверт секретного чата");
  const epoch = generation;
  const record = await read(parts[0], ownerId);
  if (!record.chatId) throw new Error("Ключ не привязан к секретному чату");
  const text = await decryptMessageWithPrivateKey({ ...params, privateKey: record.privateKey, encryptedKey: parts[1], context: secretEncryptionContext(record.chatId) });
  if (epoch !== generation || record.expiresAt <= Date.now()) throw new Error("Секретный чат недоступен после смены аккаунта или истечения срока");
  return text;
}

// null removes only expired records, including those from an inactive account.
export async function deleteSecretDeviceKeys(ownerId: string | null, chatId?: string) {
  if (ownerId !== null) generation += 1;
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keys", "readwrite");
      const request = tx.objectStore("keys").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const record = cursor.value as DeviceKey;
        if ((record.ownerId === ownerId && (!chatId || record.chatId === chatId)) || record.expiresAt <= Date.now()) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function secretSafetyCode(chatId: string, publicKeys: string[]) {
  if (publicKeys.length !== 2 || publicKeys.some(key => !key)) throw new Error("Ключи ещё не согласованы");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
    JSON.stringify(["eclipse-secret-safety-v2", chatId, ...publicKeys.slice().sort()]),
  )));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("").match(/.{1,4}/g)!.join(" ");
}
