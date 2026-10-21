"use client";

export type AppToastPayload = {
  title: string;
  description?: string;
  type?: "success" | "info" | "error";
  icon?: "shield-check" | "shield-alert" | "shield-x" | "globe" | "globe-x" | "laptop-check" | "info" | "copy";
  durationMs?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
    closeOnClick?: boolean;
  }>;
};

const APP_TOAST_EVENT = "eclipse:app-toast";

export function showAppToast(payload: AppToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppToastPayload>(APP_TOAST_EVENT, { detail: payload }));
}

// Legacy chat actions must use the mounted Eclipse viewport too.
export const appToast = {
  success: (title: string) => showAppToast({ title, type: "success" }),
  info: (title: string) => showAppToast({ title, type: "info" }),
  error: (title: string) => showAppToast({ title, type: "error" }),
};

export { APP_TOAST_EVENT };
