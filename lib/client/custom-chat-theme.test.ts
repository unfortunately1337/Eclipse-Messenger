import { expect, it, vi } from "vitest";
import { normalizeLiveBackgroundSettings, loadLiveBackgroundSettings, saveLiveBackgroundSettings, updateLiveBackgroundSettings, LIVE_BACKGROUND_STORAGE_KEY, LEGACY_LIVE_BACKGROUND_STORAGE_KEY, CHAT_THEME_SESSION_KEY, CHAT_THEME_PREVIEW_KEY } from "./live-background";
import { DEFAULT_CUSTOM_CHAT_THEME, normalizeCustomChatTheme, customThemeMessageBackground, customThemeChatBackground, customThemeTextColor, customThemeReactionSurface } from "./custom-chat-theme";
import { getMessageTailColor } from "../message-surface";

it("keeps saved custom colors and selection when reading settings", () => {
  const settings = normalizeLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
  expect(settings.customTheme).toEqual(DEFAULT_CUSTOM_CHAT_THEME);
  expect(settings.customThemeEnabled).toBe(true);
  expect(normalizeLiveBackgroundSettings({ customThemeEnabled: true }).customThemeEnabled).toBe(false);
});
it("rejects invalid CSS colors from persisted settings", () => {
  expect(normalizeCustomChatTheme({ ...DEFAULT_CUSTOM_CHAT_THEME, background: "url(https://example.com/image)" })).toBeNull();
  expect(normalizeCustomChatTheme({ ...DEFAULT_CUSTOM_CHAT_THEME, name: "  " })?.name).toBe("Моя тема");
  expect(normalizeCustomChatTheme({ ...DEFAULT_CUSTOM_CHAT_THEME, replyBackground: "#abcdef" })?.replyBackground).toBe("#abcdef");
  expect(normalizeCustomChatTheme({ ...DEFAULT_CUSTOM_CHAT_THEME, replyBackground: "url(x)" })?.replyBackground).toBeUndefined();
});
it("matches the outgoing tail to the gradient bottom and chooses readable text", () => {
  expect(getMessageTailColor({ background: customThemeMessageBackground(DEFAULT_CUSTOM_CHAT_THEME) })).toBe(DEFAULT_CUSTOM_CHAT_THEME.outgoingBottom);
  expect(customThemeMessageBackground(DEFAULT_CUSTOM_CHAT_THEME, false)).toBe(DEFAULT_CUSTOM_CHAT_THEME.outgoingBottom);
  expect(customThemeTextColor({ ...DEFAULT_CUSTOM_CHAT_THEME, outgoingTop: "#ffffff", outgoingBottom: "#eeeeee" })).toBe("#18181b");
  expect(customThemeTextColor(DEFAULT_CUSTOM_CHAT_THEME)).toBe("#ffffff");
});
it("limits image sources and preserves gradient direction", () => {
  expect(customThemeChatBackground({ ...DEFAULT_CUSTOM_CHAT_THEME, backgroundMode: "gradient", backgroundAngle: 90 })).toContain("linear-gradient(90deg");
  expect(normalizeCustomChatTheme({ ...DEFAULT_CUSTOM_CHAT_THEME, backgroundMode: "image", wallpaper: "https://example.com/tracker" })?.wallpaper).toBeUndefined();
});

it("keeps reaction counters readable across light, dark and mixed custom themes", () => {
  const luminance = (values: number[]) => values.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  for (const top of ["#000000", "#ffffff", "#888888", "#ff0044"]) {
    for (const bottom of ["#000000", "#ffffff", "#6366f1"]) {
      for (const mine of [true, false]) for (const reacted of [true, false]) {
        const surface = customThemeReactionSurface({ ...DEFAULT_CUSTOM_CHAT_THEME, outgoingTop: top, outgoingBottom: bottom, incoming: top }, mine, reacted);
        const background = luminance(surface.backgroundColor.match(/\d+/g)!.map(Number));
        const foreground = luminance([1, 3, 5].map(index => parseInt(surface.color.slice(index, index + 2), 16)));
        expect((Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
it("retains custom themes after closing a tab and ignores stale sessions", () => {
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) });
  vi.stubGlobal("window", { localStorage: storage(local), sessionStorage: storage(session), dispatchEvent: () => true });
  try {
    saveLiveBackgroundSettings(normalizeLiveBackgroundSettings({ transparentVisual: false, customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true }));
    expect(JSON.parse(local.get(LIVE_BACKGROUND_STORAGE_KEY)!).customTheme).toEqual(DEFAULT_CUSTOM_CHAT_THEME);
    expect(session.has(CHAT_THEME_SESSION_KEY)).toBe(false);
    expect(loadLiveBackgroundSettings().customThemeEnabled).toBe(true);
    session.clear();
    expect(loadLiveBackgroundSettings()).toMatchObject({ transparentVisual: false, customThemeEnabled: true, neatPreset: "none" });
    expect(loadLiveBackgroundSettings({ previewLastTheme: true })).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true, transparentVisual: false });
    session.set(CHAT_THEME_SESSION_KEY, JSON.stringify({ neatPreset: "ocean", customThemeEnabled: false }));
    expect(loadLiveBackgroundSettings({ previewLastTheme: true })).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
  } finally { vi.unstubAllGlobals(); }
});

it("recovers old invitation previews but rejects damaged or unsafe saved themes", () => {
  const local = new Map<string, string>([
    [LIVE_BACKGROUND_STORAGE_KEY, JSON.stringify({ transparentVisual: false })],
    [CHAT_THEME_PREVIEW_KEY, JSON.stringify({ neatPreset: "emerald", customThemeEnabled: true, customTheme: { ...DEFAULT_CUSTOM_CHAT_THEME, background: "url(https://foreign.test/image)" } })],
  ]);
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => local.get(key) ?? null }, sessionStorage: { getItem: () => null } });
  try {
    expect(loadLiveBackgroundSettings()).toMatchObject({ neatPreset: "emerald", transparentVisual: false, customTheme: null });
    expect(loadLiveBackgroundSettings({ previewLastTheme: true })).toMatchObject({ neatPreset: "emerald", customTheme: null, customThemeEnabled: false });
    local.set(CHAT_THEME_PREVIEW_KEY, "{broken");
    expect(loadLiveBackgroundSettings({ previewLastTheme: true })).toMatchObject({ neatPreset: "none", transparentVisual: false });
  } finally { vi.unstubAllGlobals(); }
});

it("does not reset device preferences when the session theme is damaged", () => {
  vi.stubGlobal("window", {
    localStorage: { getItem: () => JSON.stringify({ transparentVisual: false, opacity: 0.6, messageThemeEnabled: false }) },
    sessionStorage: { getItem: () => "{broken" },
  });
  try {
    expect(loadLiveBackgroundSettings()).toMatchObject({ transparentVisual: false, opacity: 0.6, messageThemeEnabled: false, customThemeEnabled: false });
  } finally { vi.unstubAllGlobals(); }
});

function themeStorageFixture() {
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  });
  const browser = { localStorage: storage(local), sessionStorage: storage(session), dispatchEvent: vi.fn(() => true) };
  vi.stubGlobal("window", browser);
  return { local, session, browser };
}

it("recovers a legacy custom image theme after its session disappears", () => {
  const { local, session } = themeStorageFixture();
  const imageTheme = { ...DEFAULT_CUSTOM_CHAT_THEME, backgroundMode: "image" as const, wallpaper: "data:image/png;base64,AAAA" };
  try {
    local.set(LEGACY_LIVE_BACKGROUND_STORAGE_KEY, JSON.stringify({ transparentVisual: false }));
    local.set(CHAT_THEME_PREVIEW_KEY, JSON.stringify({ customTheme: imageTheme, customThemeEnabled: true }));
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: imageTheme, customThemeEnabled: true, transparentVisual: false });
    session.set(CHAT_THEME_SESSION_KEY, JSON.stringify({ customTheme: null }));
    updateLiveBackgroundSettings({ opacity: 0.4 });
    session.clear();
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: imageTheme, customThemeEnabled: true, opacity: 0.4 });
    expect(local.has(CHAT_THEME_PREVIEW_KEY)).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});

it("keeps the saved theme in the catalogue when selecting a built-in theme", () => {
  themeStorageFixture();
  try {
    updateLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    updateLiveBackgroundSettings({ neatPreset: "ocean", customThemeEnabled: false });
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, neatPreset: "ocean", customThemeEnabled: false });
  } finally { vi.unstubAllGlobals(); }
});

it("merges consecutive settings edits without relying on a committed React render", () => {
  themeStorageFixture();
  try {
    updateLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    updateLiveBackgroundSettings({ transparentVisual: false });
    updateLiveBackgroundSettings({ opacity: 0.5 });
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true, transparentVisual: false, opacity: 0.5 });
  } finally { vi.unstubAllGlobals(); }
});

it("does not resurrect an explicitly deleted theme from a stale tab or backup", () => {
  const { local, session } = themeStorageFixture();
  try {
    updateLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    updateLiveBackgroundSettings({ customTheme: null, customThemeEnabled: false });
    const stale = JSON.stringify({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    session.set(CHAT_THEME_SESSION_KEY, stale); local.set(CHAT_THEME_PREVIEW_KEY, stale);
    updateLiveBackgroundSettings({ opacity: 0.4 });
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: null, customThemeEnabled: false });
  } finally { vi.unstubAllGlobals(); }
});

it("protects new saves from older tabs writing the old appearance key", () => {
  const { local } = themeStorageFixture();
  try {
    updateLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    local.set(LEGACY_LIVE_BACKGROUND_STORAGE_KEY, JSON.stringify({ customTheme: null, transparentVisual: false }));
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true, transparentVisual: true });
  } finally { vi.unstubAllGlobals(); }
});

it("can save and reload without access to session storage", () => {
  const { browser } = themeStorageFixture();
  try {
    Object.defineProperty(browser, "sessionStorage", { get: () => { throw new Error("blocked"); } });
    updateLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
  } finally { vi.unstubAllGlobals(); }
});

it("frees the obsolete duplicate image before retrying a quota-limited save", () => {
  const { local, browser } = themeStorageFixture();
  try {
    local.set(CHAT_THEME_PREVIEW_KEY, JSON.stringify({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true }));
    const set = browser.localStorage.setItem;
    browser.localStorage.setItem = (key, value) => {
      if (key === LIVE_BACKGROUND_STORAGE_KEY && local.has(CHAT_THEME_PREVIEW_KEY)) throw new DOMException("full", "QuotaExceededError");
      set(key, value);
    };
    updateLiveBackgroundSettings({ opacity: 0.4 });
    expect(local.has(CHAT_THEME_PREVIEW_KEY)).toBe(false);
    expect(loadLiveBackgroundSettings()).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    expect(browser.dispatchEvent).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});

it("retains the previous theme and backup if the authoritative write fails", () => {
  const { local, browser } = themeStorageFixture();
  try {
    updateLiveBackgroundSettings({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true });
    const backup = JSON.stringify({ customTheme: DEFAULT_CUSTOM_CHAT_THEME });
    local.set(CHAT_THEME_PREVIEW_KEY, backup);
    browser.dispatchEvent.mockClear();
    const set = browser.localStorage.setItem;
    browser.localStorage.setItem = (key, value) => {
      if (key === LIVE_BACKGROUND_STORAGE_KEY) throw new DOMException("full", "QuotaExceededError");
      set(key, value);
    };
    expect(() => updateLiveBackgroundSettings({ customTheme: { ...DEFAULT_CUSTOM_CHAT_THEME, name: "New" } })).toThrow();
    expect(local.get(CHAT_THEME_PREVIEW_KEY)).toBe(backup);
    expect(loadLiveBackgroundSettings().customTheme?.name).toBe(DEFAULT_CUSTOM_CHAT_THEME.name);
    expect(browser.dispatchEvent).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
