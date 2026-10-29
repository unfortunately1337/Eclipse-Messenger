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

// Keep the new authoritative record away from writes by older open tabs.
export const LIVE_BACKGROUND_STORAGE_KEY = "eclipse:settings:appearance:v2";
export const LEGACY_LIVE_BACKGROUND_STORAGE_KEY = "eclipse:settings:live-background:v1";
export const CHAT_THEME_SESSION_KEY = "eclipse:settings:chat-theme:session:v1";
// Legacy invitation preview: also used to recover themes from older versions.
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

// Version 2 stores the complete appearance atomically, including custom themes.
const STORAGE_VERSION = 2;

export function loadLiveBackgroundSettings(_options?: { previewLastTheme?: boolean }): LiveBackgroundSettings {
  // Preserve the old invite-call signature; all callers now restore durable themes.
  void _options;
  if (typeof window === "undefined") return DEFAULT_LIVE_BACKGROUND_SETTINGS;
  const read = (storage: () => Storage, key: string): Record<string, unknown> => {
    try {
      const raw = storage().getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  };
  const appearance = {
    ...read(() => window.localStorage, LEGACY_LIVE_BACKGROUND_STORAGE_KEY),
    ...read(() => window.localStorage, LIVE_BACKGROUND_STORAGE_KEY),
  };
  // An old tab's session must never overwrite a new persistent save or deletion.
  if (appearance.storageVersion === STORAGE_VERSION) return normalizeLiveBackgroundSettings(appearance);

  const preview = read(() => window.localStorage, CHAT_THEME_PREVIEW_KEY);
  const session = read(() => window.sessionStorage, CHAT_THEME_SESSION_KEY);
  const recoveredTheme = normalizeCustomChatTheme(session.customTheme)
    ?? normalizeCustomChatTheme(appearance.customTheme)
    ?? normalizeCustomChatTheme(preview.customTheme);
  // Recover saved definitions even if a newer, empty tab has a null session theme.
  const recovered = normalizeLiveBackgroundSettings({ ...appearance, ...preview, ...session, customTheme: recoveredTheme } as Partial<LiveBackgroundSettings>);
  if (recoveredTheme) {
    try { persistLiveBackgroundSettings(recovered); } catch { /* Keep legacy data readable when persistent storage is unavailable. */ }
  }
  return recovered;
}

function persistLiveBackgroundSettings(normalized: LiveBackgroundSettings) {
  const storage = window.localStorage;
  const serialized = JSON.stringify({ ...normalized, storageVersion: STORAGE_VERSION });
  try {
    storage.setItem(LIVE_BACKGROUND_STORAGE_KEY, serialized);
  } catch (failure) {
    // Old image themes were duplicated in the preview key and could exhaust quota.
    const quota = failure && typeof failure === "object" && "name" in failure && failure.name === "QuotaExceededError";
    const backup = quota ? storage.getItem(CHAT_THEME_PREVIEW_KEY) : null;
    if (!backup) throw failure;
    storage.removeItem(CHAT_THEME_PREVIEW_KEY);
    try { storage.setItem(LIVE_BACKGROUND_STORAGE_KEY, serialized); }
    catch (retryFailure) {
      try { storage.setItem(CHAT_THEME_PREVIEW_KEY, backup); } catch { /* Preserve the original failure. */ }
      throw retryFailure;
    }
  }
  // Only discard legacy copies after the authoritative write has succeeded.
  try { storage.removeItem(CHAT_THEME_PREVIEW_KEY); } catch { /* Persistent save is already committed. */ }
  try { window.sessionStorage.removeItem(CHAT_THEME_SESSION_KEY); } catch { /* Session storage is optional. */ }
}

export function saveLiveBackgroundSettings(next: LiveBackgroundSettings) {
  if (typeof window === "undefined") return;
  const normalized = normalizeLiveBackgroundSettings(next);
  persistLiveBackgroundSettings(normalized);
  window.dispatchEvent(new CustomEvent(LIVE_BACKGROUND_UPDATED_EVENT, { detail: normalized }));
}

export function updateLiveBackgroundSettings(patch: Partial<LiveBackgroundSettings>) {
  // Read the latest stored state, not a potentially stale React render or tab.
  const next = normalizeLiveBackgroundSettings({ ...loadLiveBackgroundSettings(), ...patch });
  saveLiveBackgroundSettings(next);
  return next;
}
