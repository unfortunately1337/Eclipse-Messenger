"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { subscribeToUserMessageEvents } from "@/lib/client/realtime/pusher";
import { initMessageNotificationsRuntime } from "@/lib/client/realtime/notifications";
import { registerBeamsDeviceForUser } from "@/lib/client/realtime/beams";

type AppNotificationsBootstrapProps = {
  userId: string;
};

const NOTIFICATIONS_PERMISSION_ASKED_KEY_PREFIX = "eclipse:notifications:permission-asked:";

function notificationsPermissionAskedKey(userId: string) {
  return `${NOTIFICATIONS_PERMISSION_ASKED_KEY_PREFIX}${userId}`;
}

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/^\/chat\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function canAskNotificationPermission() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
}

function wasPermissionAsked(userId: string) {
  try {
    return window.localStorage.getItem(notificationsPermissionAskedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markPermissionAsked(userId: string) {
  try {
    window.localStorage.setItem(notificationsPermissionAskedKey(userId), "1");
  } catch {
    // ignore storage failures
  }
}

export default function AppNotificationsBootstrap({ userId }: AppNotificationsBootstrapProps) {
  const pathname = usePathname();
  const router = useRouter();
  const runtimeRef = useRef<Awaited<ReturnType<typeof initMessageNotificationsRuntime>> | null>(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribePusher: (() => void) | null = null;

    async function setup() {
      const runtime = await initMessageNotificationsRuntime({
        currentUserId: userId,
        getActiveChatId: () => extractChatId(window.location.pathname),
        buildChatUrl: (chatId) => `/chat/${encodeURIComponent(chatId)}`,
        onOpenChat: ({ url }) => {
          router.push(url);
        },
      });

      if (disposed) {
        runtime.destroy();
        return;
      }

      runtimeRef.current = runtime;
      runtime.updateActiveChat(extractChatId(window.location.pathname));

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        await registerBeamsDeviceForUser(userId).catch(error => console.warn("Push registration unavailable", error));
      }

      const unsubscribe = await subscribeToUserMessageEvents({
        userId,
        onMessage: async (message) => {
          await runtime.handleIncomingMessage(message);
        },
      });
      if (disposed) unsubscribe();
      else unsubscribePusher = unsubscribe;
    }

    void setup().catch(error => console.warn("Message notifications unavailable", error));

    return () => {
      disposed = true;
      unsubscribePusher?.();
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, [router, userId]);

  useEffect(() => {
    runtimeRef.current?.updateActiveChat(extractChatId(pathname));
  }, [pathname]);

  useEffect(() => {
    if (!canAskNotificationPermission() || wasPermissionAsked(userId)) return;

    let disposed = false;

    async function requestSystemPermission() {
      if (disposed || !canAskNotificationPermission()) return;
      markPermissionAsked(userId);

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registerBeamsDeviceForUser(userId);
      }
    }

    const onFirstUserAction = () => {
      window.removeEventListener("pointerdown", onFirstUserAction);
      window.removeEventListener("keydown", onFirstUserAction);
      window.removeEventListener("touchstart", onFirstUserAction);
      void requestSystemPermission().catch(error => console.warn("Notification permission unavailable", error));
    };

    window.addEventListener("pointerdown", onFirstUserAction, { once: true, passive: true });
    window.addEventListener("keydown", onFirstUserAction, { once: true });
    window.addEventListener("touchstart", onFirstUserAction, { once: true, passive: true });

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", onFirstUserAction);
      window.removeEventListener("keydown", onFirstUserAction);
      window.removeEventListener("touchstart", onFirstUserAction);
    };
  }, [userId]);

  return null;
}
