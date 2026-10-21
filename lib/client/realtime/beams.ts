"use client";

type BeamsClient = {
  start: () => Promise<void>;
  addDeviceInterest: (interest: string) => Promise<void>;
};

type BeamsFactory = {
  Client: new (config: { instanceId: string }) => BeamsClient;
};

const BEAMS_SCRIPT_URL = "https://js.pusher.com/beams/2.1.0/push-notifications-cdn.js";
let beamsScriptPromise: Promise<BeamsFactory> | null = null;

function getInstanceId(): string | null {
  const raw = process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID;
  const value = typeof raw === "string" ? raw.trim() : "";
  return value.length > 0 ? value : null;
}

async function ensureBeamsScript(): Promise<BeamsFactory> {
  const existing = (window as Window & { PusherPushNotifications?: BeamsFactory }).PusherPushNotifications;
  if (existing) return existing;

  if (!beamsScriptPromise) {
    beamsScriptPromise = new Promise<BeamsFactory>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = BEAMS_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const loaded = (window as Window & { PusherPushNotifications?: BeamsFactory }).PusherPushNotifications;
        if (!loaded) {
          reject(new Error("Beams SDK loaded but global object is missing"));
          return;
        }
        resolve(loaded);
      };
      script.onerror = () => reject(new Error("Failed to load Beams SDK"));
      document.head.appendChild(script);
    });
  }

  return beamsScriptPromise;
}

export async function registerBeamsDeviceForUser(userId: string): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return;
  }
  const instanceId = getInstanceId();
  if (!instanceId) return;
  if (Notification.permission !== "granted") return;

  const beams = await ensureBeamsScript();
  const client = new beams.Client({ instanceId });
  await client.start();
  await client.addDeviceInterest(`user-${userId}`);
}
