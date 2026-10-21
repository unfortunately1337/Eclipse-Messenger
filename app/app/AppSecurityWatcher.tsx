"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useRef } from "react";
import { apiRequest, forceLogoutAndRedirect } from "@/lib/client/http";

type MePayload = {
  id: string;
};

type RealtimeSessionDestroyedPayload = {
  sessionId: string;
  userId?: string;
  reason?: "destroyed" | "expired" | "invalid" | string;
};

type PusherFactory = new (
  key: string,
  options: Record<string, unknown>,
) => {
  subscribe: (name: string) => {
    bind: (eventName: string, callback: (payload: unknown) => void) => void;
  };
  disconnect: () => void;
};

async function ensurePusherScript() {
  const existing = (window as Window & { Pusher?: PusherFactory }).Pusher;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.pusher.com/8.4.0/pusher.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t("Не удалось загрузить realtime SDK")));
    document.head.appendChild(script);
  });

  const loaded = (window as Window & { Pusher?: PusherFactory }).Pusher;
  if (!loaded) throw new Error(t("Realtime SDK не инициализирован"));
  return loaded;
}

export default function AppSecurityWatcher() {
  const t = useTranslation();
  const currentSessionIdRef = useRef<string | null>(null);
  const pusherRef = useRef<{ disconnect: () => void } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const me = await apiRequest<MePayload>("/api/auth/me", { method: "GET" });
        if (!mounted) return;

        const Pusher = await ensurePusherScript();
        if (!mounted) return;
        const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!key || !cluster) return;

        const pusher = new Pusher(key, {
          cluster,
          authEndpoint: "/api/realtime/auth",
          auth: {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
            },
          },
        });
        pusherRef.current = pusher;

        const userChannel = pusher.subscribe(`private-user-${me.id}`);
        userChannel.bind("session:destroyed", (rawPayload: unknown) => {
          if (!mounted || window.localStorage.getItem("eclipse:active-user-id") !== me.id) return;
          const payload = rawPayload as RealtimeSessionDestroyedPayload;
          if (!payload?.sessionId) return;
          if (currentSessionIdRef.current && payload.sessionId === currentSessionIdRef.current) {
            void forceLogoutAndRedirect();
          }
        });
      } catch {
        // security watcher is best-effort
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
      pusherRef.current?.disconnect();
      pusherRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ currentSessionId: string | null }>("/api/settings/sessions", { method: "GET", signal: controller.signal })
      .then((data) => {
        currentSessionIdRef.current = data.currentSessionId;
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return null;
}
