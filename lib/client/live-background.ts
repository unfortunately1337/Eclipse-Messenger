import { normalizeCustomChatTheme, type CustomChatTheme } from "./custom-chat-theme";

export type LiveBackgroundNeatPreset =
  | "none"
  | "neon"
  | "ocean"
  | "sunset"
  | "aurora"
  | "violet"
  | "emerald"
  | "crimson"
  | "mono"
  | "midnight"
  | "frost"
  | "lava";

export type LiveBackgroundSettings = {
  neatPreset: LiveBackgroundNeatPreset;
  opacity: number;
  motionSpeed: number;
  messageThemeEnabled: boolean;
  transparentVisual?: boolean;
  customTheme?: CustomChatTheme | null;
  customThemeEnabled?: boolean;
};

export const LIVE_BACKGROUND_STORAGE_KEY = "eclipse:settings:live-background:v1";
export const CHAT_THEME_SESSION_KEY = "eclipse:settings:chat-theme:session:v1";
// Invite links can open in a fresh tab, where the chat's session storage is absent.
export const CHAT_THEME_PREVIEW_KEY = "eclipse:settings:chat-theme:preview:v1";
export const LIVE_BACKGROUND_UPDATED_EVENT = "eclipse:live-background:updated";

export const DEFAULT_LIVE_BACKGROUND_SETTINGS: LiveBackgroundSettings = {
  neatPreset: "none",
  opacity: 0.28,
  motionSpeed: 0.3,
  messageThemeEnabled: true,
  transparentVisual: true,
};

function normalizeMessageThemeEnabled(value: unknown) {
  return typeof value === "boolean" ? value : DEFAULT_LIVE_BACKGROUND_SETTINGS.messageThemeEnabled;
}

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIVE_BACKGROUND_SETTINGS.opacity;
  return Math.max(0.05, Math.min(0.6, value));
}

function clampMotionSpeed(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LIVE_BACKGROUND_SETTINGS.motionSpeed;
  return Math.max(0, Math.min(1, value));
}

export function normalizeLiveBackgroundSettings(
  input?: Partial<LiveBackgroundSettings> | null,
): LiveBackgroundSettings {
  const preset = input?.neatPreset;
  return {
    neatPreset:
      preset === "none" ||
      preset === "neon" ||
      preset === "ocean" ||
      preset === "sunset" ||
      preset === "aurora" ||
      preset === "violet" ||
      preset === "emerald" ||
      preset === "crimson" ||
      preset === "mono" ||
      preset === "midnight" ||
      preset === "frost" ||
      preset === "lava"
        ? preset
        : "none",
    opacity: clampOpacity(Number(input?.opacity)),
    motionSpeed: clampMotionSpeed(Number(input?.motionSpeed)),
    messageThemeEnabled: normalizeMessageThemeEnabled(input?.messageThemeEnabled),
    transparentVisual: typeof input?.transparentVisual === "boolean" ? input.transparentVisual : DEFAULT_LIVE_BACKGROUND_SETTINGS.transparentVisual,
    customTheme: normalizeCustomChatTheme(input?.customTheme),
    customThemeEnabled: input?.customThemeEnabled === true && normalizeCustomChatTheme(input?.customTheme) !== null,
  };
}

export function loadLiveBackgroundSettings(options?: { previewLastTheme?: boolean }): LiveBackgroundSettings {
  if (typeof window === "undefined") return DEFAULT_LIVE_BACKGROUND_SETTINGS;
  const read = (storage: () => Storage, key: string): Partial<LiveBackgroundSettings> => {
    try {
      const raw = storage().getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  };
  // A damaged session theme must not reset the independent device preferences.
  const appearance = read(() => window.localStorage, LIVE_BACKGROUND_STORAGE_KEY);
  const previewTheme = options?.previewLastTheme ? read(() => window.localStorage, CHAT_THEME_PREVIEW_KEY) : {};
  const sessionTheme = read(() => window.sessionStorage, CHAT_THEME_SESSION_KEY);
  return normalizeLiveBackgroundSettings({ ...appearance, neatPreset: "none", customTheme: null, customThemeEnabled: false, ...previewTheme, ...sessionTheme });
}

export function saveLiveBackgroundSettings(next: LiveBackgroundSettings) {
  if (typeof window === "undefined") return;
  const { neatPreset, customTheme, customThemeEnabled, ...appearance } = next;
  window.sessionStorage.setItem(CHAT_THEME_SESSION_KEY, JSON.stringify({ neatPreset, customTheme, customThemeEnabled }));
  window.localStorage.setItem(LIVE_BACKGROUND_STORAGE_KEY, JSON.stringify(appearance));
  try {
    window.localStorage.setItem(CHAT_THEME_PREVIEW_KEY, JSON.stringify({ neatPreset, customTheme, customThemeEnabled }));
  } catch { /* A full local store must not prevent selecting a theme in this tab. */ }
  window.dispatchEvent(new CustomEvent(LIVE_BACKGROUND_UPDATED_EVENT, { detail: next }));
}
