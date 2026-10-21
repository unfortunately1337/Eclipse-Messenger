"use client";
import { translate as t } from "@/lib/i18n/translate";

import {
  decryptMessageWithPrivateKeyBase64,
  loadStoredE2EKeyPairs,
  loadSharedChatKeys,
  decryptWithSharedKey,
} from "../e2e";

export type MessageNotificationEvent = {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: string;
  cipherText?: string | null;
  iv?: string | null;
  encryptedKey?: string | null;
  keyVersion?: number | null;
};

type RuntimeOptions = {
  currentUserId: string;
  getActiveChatId: () => string | null;
  onOpenChat: (params: { chatId: string; url: string }) => void;
  buildChatUrl?: (chatId: string) => string;
};

type Runtime = {
  requestPermission: () => Promise<NotificationPermission | "unsupported">;
  handleIncomingMessage: (message: MessageNotificationEvent) => Promise<void>;
  updateActiveChat: (chatId: string | null) => void;
  destroy: () => void;
};

type HandleIncomingMessageContext = {
  currentUserId: string;
  getActiveChatId: () => string | null;
  buildChatUrl?: (chatId: string) => string;
};

type ShowNotificationOptions = {
  registration?: ServiceWorkerRegistration | null;
  buildChatUrl?: (chatId: string) => string;
};

const SW_FILE = "/service-worker.js";
const FALLBACK_ICON = "/brand/hello_light.png";
const TAB_KEY_PREFIX = "msg-notify:tab:";
const MESSAGE_LOCK_PREFIX = "msg-notify:lock:";
const MUTED_CHAT_IDS_KEY_PREFIX = "eclipse:muted-chat-ids:";
const TAB_TTL_MS = 20_000;
const MESSAGE_LOCK_TTL_MS = 30_000;
const TAB_HEARTBEAT_MS = 5_000;
const newMessageNotificationText = () => t("Новое сообщение");

function normalizeText(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return newMessageNotificationText();
  // Truncate to 120 chars max for notification display
  return trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildDefaultChatUrl(chatId: string): string {
  return `/chat/${encodeURIComponent(chatId)}`;
}

function mutedChatIdsStorageKey(userId: string): string {
  return `${MUTED_CHAT_IDS_KEY_PREFIX}${userId}`;
}

export function loadMutedChatIds(userId: string): Set<string> {
  if (typeof window === "undefined" || !userId) return new Set();
  try {
    const raw = window.localStorage.getItem(mutedChatIdsStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0));
  } catch {
    return new Set();
  }
}

export function saveMutedChatIds(userId: string, mutedChatIds: Iterable<string>) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const next = Array.from(new Set(Array.from(mutedChatIds).filter((value) => typeof value === "string" && value.trim().length > 0)));
    window.localStorage.setItem(mutedChatIdsStorageKey(userId), JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function isChatMutedForUser(userId: string, chatId: string): boolean {
  if (!userId || !chatId) return false;
  return loadMutedChatIds(userId).has(chatId);
}

function resolveIconUrl(icon: string): string {
  if (!icon) return FALLBACK_ICON;
  try {
    const resolved = new URL(icon, window.location.origin);
    return resolved.href;
  } catch {
    return FALLBACK_ICON;
  }
}

function canUseNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  const byScope = await navigator.serviceWorker.getRegistration();
  if (byScope) return byScope;
  const byFile = await navigator.serviceWorker.getRegistration(SW_FILE);
  return byFile ?? null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!canUseNotifications()) {
    return "unsupported";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

async function tryDecryptClientMessage(message: MessageNotificationEvent): Promise<string> {
  const defaultText = message.text || newMessageNotificationText();
  if (!message.cipherText || !message.iv) {
    return defaultText;
  }
  try {
    if (message.encryptedKey) {
      const keys = loadStoredE2EKeyPairs();
      for (const k of keys) {
        try {
          const decrypted = await decryptMessageWithPrivateKeyBase64({
            privateKeyBase64: k.privateKeyBase64,
            cipherText: message.cipherText,
            iv: message.iv,
            encryptedKey: message.encryptedKey,
          });
          if (decrypted) return decrypted;
        } catch {
          // try next key
        }
      }
    } else if (message.keyVersion) {
      const keys = loadSharedChatKeys(message.chatId);
      const matchingKey = keys.find((k) => k.version === message.keyVersion);
      if (matchingKey) {
        const decrypted = await decryptWithSharedKey({
          cipherText: message.cipherText,
          iv: message.iv,
          keyBase64: matchingKey.keyBase64,
        });
        if (decrypted) return decrypted;
      }
    }
  } catch (e) {
    console.error("Client decryption failed", e);
  }
  return defaultText;
}

export async function showMessageNotification(
  message: MessageNotificationEvent,
  options: ShowNotificationOptions = {},
): Promise<boolean> {
  if (!canUseNotifications()) {
    return false;
  }
  if (Notification.permission !== "granted") {
    return false;
  }

  const url = (options.buildChatUrl ?? buildDefaultChatUrl)(message.chatId);
  const title = message.senderName || newMessageNotificationText();
  const body = await tryDecryptClientMessage(message);
  const icon = resolveIconUrl(message.senderAvatar);
  const data = {
    messageId: message.messageId,
    chatId: message.chatId,
    url,
    deepLink: url,
    createdAt: message.createdAt,
  };

  const registration = options.registration ?? (await getServiceWorkerRegistration());
  if (registration) {
    await registration.showNotification(title, {
      body,
      icon,
      badge: FALLBACK_ICON,
      tag: `message:${message.messageId}`,

      data,
    });
    return true;
  }

  // Fallback for browsers without Service Worker support.
  const notification = new Notification(title, { body, icon, data, tag: `message:${message.messageId}` });
  notification.onclick = () => {
    window.focus();
    window.location.href = url;
  };
  return true;
}

function listTabStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(TAB_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

function touchTabState(tabId: string, activeChatId: string | null) {
  try {
    const state = {
      tabId,
      activeChatId,
      visibility: document.visibilityState,
      ts: Date.now(),
    };
    localStorage.setItem(`${TAB_KEY_PREFIX}${tabId}`, JSON.stringify(state));
  } catch {
    // localStorage can be unavailable in private mode.
  }
}

function cleanupStaleTabs() {
  try {
    const now = Date.now();
    for (const key of listTabStorageKeys(localStorage)) {
      const state = parseJson<{ ts?: number }>(localStorage.getItem(key));
      if (!state?.ts || now - state.ts > TAB_TTL_MS) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage failures
  }
}

function isChatVisibleInAnyTab(chatId: string): boolean {
  try {
    const now = Date.now();
    for (const key of listTabStorageKeys(localStorage)) {
      const state = parseJson<{
        activeChatId?: string | null;
        visibility?: string;
        ts?: number;
      }>(localStorage.getItem(key));
      if (!state?.ts || now - state.ts > TAB_TTL_MS) continue;
      if (state.activeChatId === chatId && state.visibility === "visible") {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function claimMessageLock(messageId: string, tabId: string): boolean {
  const key = `${MESSAGE_LOCK_PREFIX}${messageId}`;
  const now = Date.now();
  try {
    const existing = parseJson<{ tabId?: string; expiresAt?: number }>(localStorage.getItem(key));
    if (existing?.expiresAt && existing.expiresAt > now && existing.tabId !== tabId) {
      return false;
    }
    const record = { tabId, expiresAt: now + MESSAGE_LOCK_TTL_MS };
    localStorage.setItem(key, JSON.stringify(record));
    const check = parseJson<{ tabId?: string; expiresAt?: number }>(localStorage.getItem(key));
    return Boolean(check?.tabId === tabId && check.expiresAt && check.expiresAt > now);
  } catch {
    return true;
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(SW_FILE, { scope: "/" });
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

function postStateToServiceWorker(registration: ServiceWorkerRegistration | null, activeChatId: string | null) {
  if (!registration) return;
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) return;
  worker.postMessage({
    type: "APP_STATE",
    payload: {
      activeChatId,
      visibility: typeof document !== "undefined" ? document.visibilityState : "hidden",
      ts: Date.now(),
    },
  });
}

function isSameChatOpenAndVisible(message: MessageNotificationEvent, activeChatId: string | null): boolean {
  if (!activeChatId) return isChatVisibleInAnyTab(message.chatId);
  if (activeChatId === message.chatId && document.visibilityState === "visible") {
    return true;
  }
  return isChatVisibleInAnyTab(message.chatId);
}

export async function handleIncomingMessage(
  message: MessageNotificationEvent,
  context: HandleIncomingMessageContext,
): Promise<void> {
  if (!message.messageId || !message.chatId) return;
  if (context.currentUserId && message.senderId === context.currentUserId) return;
  if (context.currentUserId && isChatMutedForUser(context.currentUserId, message.chatId)) return;

  const activeChatId = context.getActiveChatId();
  if (isSameChatOpenAndVisible(message, activeChatId)) return;

  const tabId = (() => {
    try {
      if (!sessionStorage.getItem("msg-notify:tab-id")) {
        sessionStorage.setItem("msg-notify:tab-id", crypto.randomUUID());
      }
      return sessionStorage.getItem("msg-notify:tab-id") || crypto.randomUUID();
    } catch {
      return crypto.randomUUID();
    }
  })();

  if (!claimMessageLock(message.messageId, tabId)) return;

  await showMessageNotification(message, { buildChatUrl: context.buildChatUrl });
}

export async function initMessageNotificationsRuntime(options: RuntimeOptions): Promise<Runtime> {
  const tabId = (() => {
    try {
      const cached = sessionStorage.getItem("msg-notify:tab-id");
      if (cached) return cached;
      const created = crypto.randomUUID();
      sessionStorage.setItem("msg-notify:tab-id", created);
      return created;
    } catch {
      return crypto.randomUUID();
    }
  })();

  let activeChatId = options.getActiveChatId();
  const registration: ServiceWorkerRegistration | null = await registerServiceWorker();
  let heartbeat: number | null = null;

  const refreshPresence = () => {
    cleanupStaleTabs();
    touchTabState(tabId, activeChatId);
    postStateToServiceWorker(registration, activeChatId);
  };

  const swMessageHandler = (event: MessageEvent<{ type?: string; payload?: { chatId?: string; url?: string } }>) => {
    if (event.data?.type !== "OPEN_CHAT") return;
    const chatId = event.data.payload?.chatId;
    const url = event.data.payload?.url ?? (chatId ? (options.buildChatUrl ?? buildDefaultChatUrl)(chatId) : null);
    if (!chatId || !url) return;
    options.onOpenChat({ chatId, url });
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", swMessageHandler as EventListener);
  }

  const onVisibilityChange = () => refreshPresence();
  const onFocus = () => refreshPresence();
  const onBlur = () => refreshPresence();
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);

  refreshPresence();
  heartbeat = window.setInterval(refreshPresence, TAB_HEARTBEAT_MS);

  return {
    requestPermission: requestNotificationPermission,
    async handleIncomingMessage(message) {
      await handleIncomingMessage(message, {
        currentUserId: options.currentUserId,
        getActiveChatId: () => activeChatId,
        buildChatUrl: options.buildChatUrl,
      });
    },
    updateActiveChat(chatId) {
      activeChatId = chatId;
      refreshPresence();
    },
    destroy() {
      if (heartbeat) {
        window.clearInterval(heartbeat);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", swMessageHandler as EventListener);
      }
      try {
        localStorage.removeItem(`${TAB_KEY_PREFIX}${tabId}`);
      } catch {
        // ignore cleanup errors
      }
    },
  };
}
