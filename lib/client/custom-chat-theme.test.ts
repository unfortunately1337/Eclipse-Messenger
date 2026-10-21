import { expect, it, vi } from "vitest";
import { normalizeLiveBackgroundSettings, loadLiveBackgroundSettings, saveLiveBackgroundSettings, LIVE_BACKGROUND_STORAGE_KEY, CHAT_THEME_SESSION_KEY, CHAT_THEME_PREVIEW_KEY } from "./live-background";
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
it("keeps chat themes in session storage while retaining the persistent glass preference", () => {
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value) });
  vi.stubGlobal("window", { localStorage: storage(local), sessionStorage: storage(session), dispatchEvent: () => true });
  try {
    saveLiveBackgroundSettings(normalizeLiveBackgroundSettings({ transparentVisual: false, customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true }));
    expect(JSON.parse(local.get(LIVE_BACKGROUND_STORAGE_KEY)!).customTheme).toBeUndefined();
    expect(JSON.parse(session.get(CHAT_THEME_SESSION_KEY)!).customThemeEnabled).toBe(true);
    expect(loadLiveBackgroundSettings().customThemeEnabled).toBe(true);
    session.clear();
    expect(loadLiveBackgroundSettings()).toMatchObject({ transparentVisual: false, customThemeEnabled: false, neatPreset: "none" });
    expect(loadLiveBackgroundSettings({ previewLastTheme: true })).toMatchObject({ customTheme: DEFAULT_CUSTOM_CHAT_THEME, customThemeEnabled: true, transparentVisual: false });
    session.set(CHAT_THEME_SESSION_KEY, JSON.stringify({ neatPreset: "ocean", customThemeEnabled: false }));
    expect(loadLiveBackgroundSettings({ previewLastTheme: true })).toMatchObject({ neatPreset: "ocean", customThemeEnabled: false });
  } finally { vi.unstubAllGlobals(); }
});

it("keeps invitation previews optional and ignores damaged or unsafe saved themes", () => {
  const local = new Map<string, string>([
    [LIVE_BACKGROUND_STORAGE_KEY, JSON.stringify({ transparentVisual: false })],
    [CHAT_THEME_PREVIEW_KEY, JSON.stringify({ neatPreset: "emerald", customThemeEnabled: true, customTheme: { ...DEFAULT_CUSTOM_CHAT_THEME, background: "url(https://foreign.test/image)" } })],
  ]);
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => local.get(key) ?? null }, sessionStorage: { getItem: () => null } });
  try {
    expect(loadLiveBackgroundSettings()).toMatchObject({ neatPreset: "none", transparentVisual: false });
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
