const FALLBACK_ICON = "/brand/hello_light.png";
const RECENT_MESSAGE_TTL_MS = 2 * 60 * 1000;
const CLIENT_STATE_TTL_MS = 30 * 1000;

const recentMessages = new Map();
const clientStates = new Map();
const LANGUAGE_CACHE = "eclipse-preferences-v1";
const LANGUAGE_CACHE_KEY = "/__eclipse_language";
async function notificationLanguage() {
  try {
    const saved = await (await caches.open(LANGUAGE_CACHE)).match(LANGUAGE_CACHE_KEY);
    return saved && await saved.text() === "ru" ? "ru" : "en";
  }
  catch { return "en"; }
}

function now() {
  return Date.now();
}

function pruneRecentMessages() {
  const current = now();
  for (const [messageId, ts] of recentMessages.entries()) {
    if (current - ts > RECENT_MESSAGE_TTL_MS) {
      recentMessages.delete(messageId);
    }
  }
}

function pruneClientStates() {
  const current = now();
  for (const [clientId, state] of clientStates.entries()) {
    if (!state.ts || current - state.ts > CLIENT_STATE_TTL_MS) {
      clientStates.delete(clientId);
    }
  }
}

function parsePayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    try {
      return JSON.parse(event.data.text());
    } catch {
      return null;
    }
  }
}

function normalizeMessage(raw) {
  const payload = raw && typeof raw === "object" ? raw : {};
  const web = payload.web && typeof payload.web === "object" ? payload.web : null;
  const webData = web && web.data && typeof web.data === "object" ? web.data : null;
  const topData = payload.data && typeof payload.data === "object" ? payload.data : null;
  const notification = web && web.notification && typeof web.notification === "object" ? web.notification : null;
  const source = webData || topData || payload;

  const messageId = typeof source.messageId === "string" ? source.messageId : typeof source.id === "string" ? source.id : "";
  const chatId = typeof source.chatId === "string" ? source.chatId : typeof source.conversationId === "string" ? source.conversationId : "";
  if (!messageId || !chatId) return null;

  const senderName =
    (typeof source.senderName === "string" && source.senderName.trim() ? source.senderName.trim() : "") ||
    (typeof notification?.title === "string" && notification.title.trim() ? notification.title.trim() : "") ||
    "New message";
  const text =
    (typeof source.text === "string" && source.text.trim() ? source.text.trim() : "") ||
    (typeof notification?.body === "string" && notification.body.trim() ? notification.body.trim() : "") ||
    "New message";
  const deepLink = typeof source.deepLink === "string" && source.deepLink.trim()
    ? source.deepLink.trim()
    : typeof notification?.deep_link === "string" && notification.deep_link.trim()
      ? notification.deep_link.trim()
      : `/chat/${encodeURIComponent(chatId)}`;

  let icon = FALLBACK_ICON;
  const rawIcon =
    typeof source.senderAvatar === "string" && source.senderAvatar.trim()
      ? source.senderAvatar
      : typeof notification?.icon === "string" && notification.icon.trim()
        ? notification.icon
        : "";
  if (rawIcon) {
    try {
      icon = new URL(rawIcon, self.location.origin).href;
    } catch {
      icon = FALLBACK_ICON;
    }
  }

  return {
    messageId,
    chatId,
    senderName,
    text,
    icon,
    deepLink,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
    cipherText: typeof source.cipherText === "string" ? source.cipherText : "",
    iv: typeof source.iv === "string" ? source.iv : "",
    encryptedKey: typeof source.encryptedKey === "string" ? source.encryptedKey : "",
    keyVersion: typeof source.keyVersion === "string" ? source.keyVersion : "",
  };
}

function extractChatIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const chatParam = parsed.searchParams.get("chat");
    if (chatParam) return decodeURIComponent(chatParam);
    const match = parsed.pathname.match(/^\/chat\/([^/]+)$/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  } catch {
    return null;
  }
}

async function hasVisibleClientForChat(chatId) {
  pruneClientStates();
  const target = (chatId || "").trim().toLowerCase();
  if (!target) return false;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    const state = clientStates.get(client.id);
    if (state && state.visibility === "visible" && state.activeChatId && state.activeChatId.trim().toLowerCase() === target) {
      return true;
    }
    const urlChatId = extractChatIdFromUrl(client.url);
    if (urlChatId && urlChatId.trim().toLowerCase() === target && client.visibilityState === "visible") {
      return true;
    }
  }
  return false;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "LANGUAGE" && event.source?.id && (data.locale === "en" || data.locale === "ru")) {
    event.waitUntil(caches.open(LANGUAGE_CACHE).then(cache => cache.put(LANGUAGE_CACHE_KEY, new Response(data.locale))).catch(() => {}));
    return;
  }
  if (data.type !== "APP_STATE") return;
  const payload = data.payload || {};
  if (!event.source || !event.source.id) return;
  clientStates.set(event.source.id, {
    activeChatId: typeof payload.activeChatId === "string" ? payload.activeChatId : null,
    visibility: payload.visibility === "visible" ? "visible" : "hidden",
    ts: typeof payload.ts === "number" ? payload.ts : now(),
  });
});

function fromBase64(value) {
  if (typeof value !== "string" || !value) return new Uint8Array(0);
  let cleaned = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
  const padLength = (4 - (cleaned.length % 4)) % 4;
  if (padLength > 0 && padLength < 4) cleaned += "=".repeat(padLength);
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return new Uint8Array(0);
  }
}

function getIndexedDBData(key) {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open("EclipseE2EKeys", 1);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("keyring")) {
          resolve(null);
          return;
        }
        const tx = db.transaction("keyring", "readonly");
        const store = tx.objectStore("keyring");
        const getReq = store.get(key);
        getReq.onerror = () => resolve(null);
        getReq.onsuccess = () => {
          try {
            resolve(getReq.result ? JSON.parse(getReq.result) : null);
          } catch (e) {
            resolve(null);
          }
        };
      };
    } catch (e) {
      resolve(null);
    }
  });
}

async function decryptDirect(cipherText, iv, encryptedKey) {
  const keyring = await getIndexedDBData("keyringData");
  if (!keyring || !keyring.keys || !keyring.keys.length) {
    throw new Error("No keyring found");
  }
  for (const k of keyring.keys) {
    try {
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        fromBase64(k.privateKeyBase64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
      );
      const rawContentKey = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        fromBase64(encryptedKey)
      );
      const contentKey = await crypto.subtle.importKey(
        "raw",
        rawContentKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      const plainBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(iv) },
        contentKey,
        fromBase64(cipherText)
      );
      return new TextDecoder().decode(plainBuffer);
    } catch (e) {
      // try next key
    }
  }
  throw new Error("Failed to decrypt with all private keys");
}

async function decryptShared(chatId, cipherText, iv, keyVersionStr) {
  const keyVersion = parseInt(keyVersionStr, 10);
  if (isNaN(keyVersion)) throw new Error("Invalid key version");
  const sharedKeyring = await getIndexedDBData("sharedKeyringData");
  if (!sharedKeyring) throw new Error("No shared keyring found");
  const entry = sharedKeyring[chatId];
  if (!entry || !entry.keys || !entry.keys.length) {
    throw new Error("No keys found for chat");
  }
  const keyObj = entry.keys.find(k => k.version === keyVersion);
  if (!keyObj) throw new Error("Key version mismatch");

  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64(keyObj.keyBase64),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(cipherText)
  );
  return new TextDecoder().decode(plainBuffer);
}

async function tryDecryptPayload(payload) {
  if (!payload.cipherText || !payload.iv) {
    return payload.text;
  }
  try {
    if (payload.encryptedKey) {
      return await decryptDirect(payload.cipherText, payload.iv, payload.encryptedKey);
    } else if (payload.keyVersion) {
      return await decryptShared(payload.chatId, payload.cipherText, payload.iv, payload.keyVersion);
    }
  } catch (e) {
    // Fail silently, fall back to "Новое сообщение"
  }
  return payload.text;
}

async function fetchSecurePayload(messageId, chatId) {
  try {
    const res = await fetch(`/api/chats/notifications/payload?messageId=${encodeURIComponent(messageId)}&chatId=${encodeURIComponent(chatId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // ignore
  }
  return null;
}

self.addEventListener("push", (event) => {
  const raw = parsePayload(event);
  const source = raw?.web?.data || raw?.data || raw;
  if (source?.type === "call") { event.waitUntil(handleCallPush(source)); return; }
  const payload = normalizeMessage(raw);
  if (!payload) return;

  event.waitUntil((async () => {
    pruneRecentMessages();
    if (recentMessages.has(payload.messageId)) {
      return;
    }
    if (await hasVisibleClientForChat(payload.chatId)) {
      return;
    }

    recentMessages.set(payload.messageId, now());

    // Attempt secure fetch and local decryption
    const defaultBody = await notificationLanguage() === "ru" ? "Новое сообщение" : "New message";
    let displayBody = defaultBody;
    try {
      const securePayload = await fetchSecurePayload(payload.messageId, payload.chatId);
      if (securePayload && securePayload.alreadyRead) {
        return;
      }
      if (securePayload) {
        const mergedPayload = { ...payload, ...securePayload };
        displayBody = await tryDecryptPayload(mergedPayload);
      } else {
        displayBody = await tryDecryptPayload(payload);
      }
    } catch (e) {
      displayBody = await tryDecryptPayload(payload);
    }

    if (!displayBody || displayBody === "New message" || displayBody === "Новое сообщение") {
      displayBody = defaultBody;
    }

    await self.registration.showNotification(payload.senderName, {
      body: displayBody,
      icon: payload.icon,
      badge: FALLBACK_ICON,
      tag: `message:${payload.messageId}`,

      data: {
        messageId: payload.messageId,
        chatId: payload.chatId,
        url: payload.deepLink,
        deepLink: payload.deepLink,
        createdAt: payload.createdAt,
      },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const chatId = typeof data.chatId === "string" ? data.chatId : "";
  const url = typeof data.url === "string" && data.url ? data.url : `/chat/${encodeURIComponent(chatId)}`;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      try {
        await client.focus();
        client.postMessage({
          type: "OPEN_CHAT",
          payload: { chatId, url },
        });
        return;
      } catch {
        // continue to the next client
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});



// Serialize updates for one call; retain the delivered state across worker restarts.
const callPushWork = new Map();
function handleCallPush(source) {
  const id = source.callId;
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) return Promise.resolve();
  const previous = callPushWork.get(id) || Promise.resolve();
  const work = previous.catch(() => {}).then(async () => {
    const response = await fetch('/api/calls/notification?id=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' });
    const tag = 'call:' + id;
    if (!response.ok) { if (response.status === 410 || response.status === 403 || response.status === 401) for (const notification of await self.registration.getNotifications({ tag })) notification.close(); return; }
    const result = await response.json();
    const call = result.data;
    if (!result.ok || !call) return;
    if (call.recipientId !== source.recipientId) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: 'CALLS_CHANGED' });
    const cache = await caches.open('eclipse-call-notifications-v1');
    const key = new Request(self.location.origin + '/__call_notification/' + id);
    const saved = await cache.match(key);
    const delivered = saved ? await saved.text() : '';
    if (call.state === 'closed') {
      for (const notification of await self.registration.getNotifications({ tag })) notification.close();
      await cache.put(key, new Response('closed'));
      return;
    }
    if (delivered === call.state || delivered === 'closed' || delivered === 'missed') return;
    // The visible app already renders the full incoming call. Background devices
    // get one OS notification with a stable tag, updated for a missed call.
    if (!windows.some(client => client.visibilityState === 'visible')) {
      const ru = await notificationLanguage() === 'ru';
      await self.registration.showNotification(call.senderName, {
        body: call.state === 'ringing' ? (ru ? '☎ Входящий звонок…' : '☎ Incoming call…') : (ru ? '☎ Пропущенный звонок' : '☎ Missed call'),
        icon: '/brand/call-notification.svg', badge: '/brand/call-notification.svg', tag, renotify: false,
        data: { url: call.deepLink, callId: id },
      });
    }
    await cache.put(key, new Response(call.state));
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - 200))) await cache.delete(old);
  }).catch(() => {});
  callPushWork.set(id, work);
  return work.finally(() => { if (callPushWork.get(id) === work) callPushWork.delete(id); });
}
