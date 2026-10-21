export type CustomChatTheme = {
  name: string; background: string; outgoingTop: string; outgoingBottom: string;
  incoming?: string; backgroundMode?: "solid" | "gradient" | "image";
  backgroundBottom?: string; backgroundAngle?: number; wallpaper?: string;
  replyBackground?: string;
  replyLine?: string;
};

export const DEFAULT_CUSTOM_CHAT_THEME: CustomChatTheme = {
  name: "Моя тема", background: "#141622", outgoingTop: "#8b5cf6", outgoingBottom: "#6366f1",
  incoming: "#212121", backgroundMode: "solid", backgroundBottom: "#302443", backgroundAngle: 135,
};

export const CUSTOM_THEME_PRESETS: Array<{ name: string; theme: Partial<CustomChatTheme> }> = [
  { name: "Неон", theme: { name: "Неон", background: "#141622", outgoingTop: "#8b5cf6", outgoingBottom: "#6366f1", incoming: "#212121", backgroundMode: "solid" } },
  { name: "Океан", theme: { name: "Океан", background: "#0d1b2a", outgoingTop: "#38bdf8", outgoingBottom: "#0284c7", incoming: "#1b2838", backgroundMode: "gradient", backgroundBottom: "#051622", backgroundAngle: 135 } },
  { name: "Изумруд", theme: { name: "Изумруд", background: "#0d1f14", outgoingTop: "#22c55e", outgoingBottom: "#16a34a", incoming: "#182b1d", backgroundMode: "solid" } },
  { name: "Закат", theme: { name: "Закат", background: "#1c110b", outgoingTop: "#f97316", outgoingBottom: "#ea580c", incoming: "#281b14", backgroundMode: "gradient", backgroundBottom: "#2e1208", backgroundAngle: 135 } },
  { name: "Полночь", theme: { name: "Полночь", background: "#0a0b14", outgoingTop: "#6366f1", outgoingBottom: "#4f46e5", incoming: "#181926", backgroundMode: "solid" } },
  { name: "Багровый", theme: { name: "Багровый", background: "#1c0d14", outgoingTop: "#f43f5e", outgoingBottom: "#e11d48", incoming: "#281620", backgroundMode: "solid" } },
];

export function normalizeCustomChatTheme(value: unknown): CustomChatTheme | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const color = /^#[0-9a-f]{6}$/i;
  if (![candidate.background, candidate.outgoingTop, candidate.outgoingBottom].every(v => typeof v === "string" && color.test(v))) return null;
  return {
    name: typeof candidate.name === "string" ? candidate.name.trim().slice(0, 32) || "Моя тема" : "Моя тема",
    background: String(candidate.background), outgoingTop: String(candidate.outgoingTop), outgoingBottom: String(candidate.outgoingBottom),
    incoming: typeof candidate.incoming === "string" && color.test(candidate.incoming) ? candidate.incoming : "#212121",
    ...(typeof candidate.replyBackground === "string" && color.test(candidate.replyBackground) ? { replyBackground: candidate.replyBackground } : {}),
    ...(typeof candidate.replyLine === "string" && color.test(candidate.replyLine) ? { replyLine: candidate.replyLine } : {}),
    backgroundMode: candidate.backgroundMode === "gradient" || candidate.backgroundMode === "image" ? candidate.backgroundMode : "solid",
    backgroundBottom: typeof candidate.backgroundBottom === "string" && color.test(candidate.backgroundBottom) ? candidate.backgroundBottom : String(candidate.background),
    backgroundAngle: typeof candidate.backgroundAngle === "number" && Number.isFinite(candidate.backgroundAngle) ? Math.max(0, Math.min(360, candidate.backgroundAngle)) : 135,
    wallpaper: typeof candidate.wallpaper === "string" && candidate.wallpaper.length <= 2_000_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(candidate.wallpaper) ? candidate.wallpaper : undefined,
  };
}

export function customThemeChatBackground(theme: CustomChatTheme) {
  if (theme.backgroundMode === "image" && theme.wallpaper) return `url("${theme.wallpaper}") center / cover no-repeat ${theme.background}`;
  if (theme.backgroundMode === "gradient") return `linear-gradient(${theme.backgroundAngle ?? 135}deg, ${theme.background}, ${theme.backgroundBottom || theme.background})`;
  return theme.background;
}

export function customThemeMessageBackground(theme: CustomChatTheme, gradient = true) {
  return gradient ? `linear-gradient(180deg, ${theme.outgoingTop}, ${theme.outgoingBottom})` : theme.outgoingBottom;
}

export function customThemeTextColor(theme: CustomChatTheme) {
  const luminance = (hex: string) => {
    const values = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
  };
  return (luminance(theme.outgoingTop) + luminance(theme.outgoingBottom)) / 2 > 0.42 ? "#18181b" : "#ffffff";
}

export function customThemeReactionSurface(theme: CustomChatTheme, isMine: boolean, reacted: boolean, gradient = true) {
  const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const base = isMine && gradient
    ? rgb(theme.outgoingTop).map((value, index) => (value + rgb(theme.outgoingBottom)[index]!) / 2)
    : rgb(isMine ? theme.outgoingBottom : theme.incoming || "#212121");
  const luminance = (values: number[]) => values.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  const light = luminance(base) > 0.35;
  const tint = light ? 0 : 255;
  const amount = reacted ? 0.22 : 0.12;
  const background = base.map(value => Math.round(value * (1 - amount) + tint * amount));
  const brightness = luminance(background);
  const darkBrightness = luminance(rgb("#18181b"));
  return {
    backgroundColor: `rgb(${background.join(", ")})`,
    color: 1.05 / (brightness + 0.05) >= (brightness + 0.05) / (darkBrightness + 0.05) ? "#ffffff" : "#18181b",
  };
}
