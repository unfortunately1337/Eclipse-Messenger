"use client";

import type { MessageNotificationEvent } from "@/lib/client/realtime/notifications";

type PusherChannel = {
  bind: (eventName: string, callback: (payload: unknown) => void) => void;
  unbind?: (eventName: string, callback?: (payload: unknown) => void) => void;
};

type PusherInstance = {
  subscribe: (channelName: string) => PusherChannel;
  unsubscribe?: (channelName: string) => void;
  disconnect: () => void;
};

type PusherFactory = new (key: string, options: Record<string, unknown>) => PusherInstance;

type RawMessageEvent = {
  id?: unknown;
  messageId?: unknown;
  chatId?: unknown;
  conversationId?: unknown;
  fromLink?: unknown;
  groupLink?: unknown;
  senderId?: unknown;
  senderName?: unknown;
  fromDisplayName?: unknown;
  senderAvatar?: unknown;
  senderAvatarUrl?: unknown;
  avatar?: unknown;
  text?: unknown;
  createdAt?: unknown;
  cipherText?: unknown;
  iv?: unknown;
  encryptedKey?: unknown;
  keyVersion?: unknown;
};

type SubscribeOptions = {
  userId: string;
  onMessage: (message: MessageNotificationEvent) => void | Promise<void>;
  pusherKey?: string;
  pusherCluster?: string;
  authEndpoint?: string;
};

const PUSHER_SCRIPT_URL = "https://js.pusher.com/8.4.0/pusher.min.js";
let pusherScriptPromise: Promise<PusherFactory> | null = null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

function normalizeIncomingMessage(raw: unknown): MessageNotificationEvent | null {
  const payload = (raw ?? {}) as RawMessageEvent;
  const messageId = readString(payload.messageId) ?? readString(payload.id);
  const chatId =
    readString(payload.chatId) ??
    readString(payload.conversationId) ??
    readString(payload.groupLink) ??
    readString(payload.fromLink);

  if (!messageId || !chatId) {
    return null;
  }

  return {
    messageId,
    chatId,
    senderId: readString(payload.senderId) ?? "",
    senderName: readString(payload.senderName) ?? readString(payload.fromDisplayName) ?? "New message",
    senderAvatar:
      readString(payload.senderAvatar) ??
      readString(payload.senderAvatarUrl) ??
      readString(payload.avatar) ??
      "",
    text: readString(payload.text) ?? "",
    createdAt: readString(payload.createdAt) ?? new Date().toISOString(),
    cipherText: readString(payload.cipherText),
    iv: readString(payload.iv),
    encryptedKey: readString(payload.encryptedKey),
    keyVersion: payload.keyVersion != null ? Number(payload.keyVersion) : null,
  };
}

async function ensurePusherScript(): Promise<PusherFactory> {
  if (typeof window === "undefined") {
    throw new Error("Pusher can be initialized only in browser");
  }
  const existing = (window as Window & { Pusher?: PusherFactory }).Pusher;
  if (existing) return existing;

  if (!pusherScriptPromise) {
    pusherScriptPromise = new Promise<PusherFactory>((resolve, reject) => {
      const current = (window as Window & { Pusher?: PusherFactory }).Pusher;
      if (current) {
        resolve(current);
        return;
      }
      const script = document.createElement("script");
      script.src = PUSHER_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const loaded = (window as Window & { Pusher?: PusherFactory }).Pusher;
        if (!loaded) {
          reject(new Error("Pusher SDK loaded but global object is missing"));
          return;
        }
        resolve(loaded);
      };
      script.onerror = () => reject(new Error("Failed to load Pusher SDK"));
      document.head.appendChild(script);
    });
  }

  return pusherScriptPromise;
}

export async function subscribeToUserMessageEvents(options: SubscribeOptions): Promise<() => void> {
  const Pusher = await ensurePusherScript();
  const pusher = new Pusher(options.pusherKey ?? "86cd1bbadf1da227f274", {
    cluster: options.pusherCluster ?? "eu",
    forceTLS: true,
    channelAuthorization: {
      endpoint: options.authEndpoint ?? "/api/realtime/auth",
      transport: "ajax",
    },
    authEndpoint: options.authEndpoint ?? "/api/realtime/auth",
    authTransport: "ajax",
    enabledTransports: ["ws", "wss"],
  });

  const channelName = `private-user-${options.userId}`;
  const channel = pusher.subscribe(channelName);
  const onMessage = (raw: unknown) => {
    const normalized = normalizeIncomingMessage(raw);
    if (!normalized) return;
    void options.onMessage(normalized);
  };

  channel.bind("message:new", onMessage);

  return () => {
    try {
      channel.unbind?.("message:new", onMessage);
      pusher.unsubscribe?.(channelName);
      pusher.disconnect();
    } catch {
      // ignore teardown errors
    }
  };
}
