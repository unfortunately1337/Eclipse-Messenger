"use client";
import { clearMediaBlobCache } from "./media-cache";
import { clearEncryptedMedia } from "./media-crypto";

type StorageLike = {
  length: number;
  key: (index: number) => string | null;
  removeItem: (key: string) => void;
};

const LOCAL_PREFIXES = ["secret_codeword_", "eclipse:cache:", "eclipse:settings:", "eclipse:pinned-chats:", "eclipse:chat:ui-settings:"];
const SESSION_PREFIXES = ["eclipse:cache:", "eclipse:settings:", "eclipse:pinned-chats:", "eclipse:chat:ui-settings:"];
const LOCAL_EXACT_KEYS = ["eclipse:session-alerts-ack"];
const SESSION_EXACT_KEYS = ["channel-draft", "group-draft"];

function clearStorage(storage: StorageLike | null, prefixes: string[], exactKeys: string[]) {
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (exactKeys.includes(key)) {
      keys.push(key);
      continue;
    }
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  });
}

export function clearUserCaches() {
  clearEncryptedMedia();
  clearMediaBlobCache();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("eclipse:caches-cleared"));
  try {
    clearStorage(window.localStorage, LOCAL_PREFIXES, LOCAL_EXACT_KEYS);
  } catch {
    // ignore
  }
  try {
    clearStorage(window.sessionStorage, SESSION_PREFIXES, SESSION_EXACT_KEYS);
  } catch {
    // ignore
  }
}
