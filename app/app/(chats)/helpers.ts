
import { dateLocale, plural, translate as t } from "@/lib/i18n/translate";
import type { CSSProperties } from "react";
import { deriveMusicLabel } from "./chat-message-transport";
import type {
  ChatSummary,
  DecryptedMessage,
  StoryMediaTransform,
  StoryOverlay,
  StoryOverlayTextLayer,
  PusherFactory,
  Window
} from "./types";
import {
  SECRET_CHAT_GRADIENTS,
  SECRET_CHAT_ICONS,
  STORY_MEDIA_MIN_SCALE,
  STORY_MEDIA_MAX_SCALE,
  STORY_MEDIA_MAX_OFFSET,
  STORY_TEXT_DEFAULT_SIZE,
  SAVED_MESSAGES_PALETTE
} from "./constants";
import { normalizeStoryOverlay } from "@/lib/story-overlay";

export function getSecretChatAvatar(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradientIndex = Math.abs(hash) % SECRET_CHAT_GRADIENTS.length;
  const iconIndex = Math.abs(hash) % SECRET_CHAT_ICONS.length;
  return {
    background: SECRET_CHAT_GRADIENTS[gradientIndex],
    Icon: SECRET_CHAT_ICONS[iconIndex],
  };
}

export { generateSecurePassword } from "@/lib/client/secure-password";

export function clampStoryOverlayUnit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clampStoryMediaTransform(value: Partial<StoryMediaTransform> | null | undefined): StoryMediaTransform {
  const scale = Math.max(STORY_MEDIA_MIN_SCALE, Math.min(STORY_MEDIA_MAX_SCALE, Number.isFinite(value?.scale) ? Number(value?.scale) : 1));
  const bgColor = typeof value?.bgColor === "string" && /^#([0-9a-fA-F]{6})$/.test(value.bgColor.trim()) ? value.bgColor.trim() : undefined;
  return {
    scale,
    x: Math.max(-STORY_MEDIA_MAX_OFFSET, Math.min(STORY_MEDIA_MAX_OFFSET, Number.isFinite(value?.x) ? Number(value?.x) : 0)),
    y: Math.max(-STORY_MEDIA_MAX_OFFSET, Math.min(STORY_MEDIA_MAX_OFFSET, Number.isFinite(value?.y) ? Number(value?.y) : 0)),
    ...(bgColor ? { bgColor } : {}),
  };
}

export function buildStoryMediaTransformStyle(transform: Partial<StoryMediaTransform> | null | undefined): CSSProperties {
  const media = clampStoryMediaTransform(transform);
  return {
    transform: `translate3d(${media.x * 100}%, ${media.y * 100}%, 0) scale(${media.scale})`,
    transformOrigin: "center",
  };
}

export function createStoryOverlayTextLayer(text: string): StoryOverlayTextLayer {
  return {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim().slice(0, 140),
    x: 0.5,
    y: 0.5,
    color: "#ffffff",
    size: STORY_TEXT_DEFAULT_SIZE,
  };
}

export function drawStoryOverlayToCanvas(
  canvas: HTMLCanvasElement,
  overlay: StoryOverlay | null | undefined,
  width: number,
  height: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const pixelWidth = Math.floor(safeWidth * dpr);
  const pixelHeight = Math.floor(safeHeight * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  canvas.style.width = `${safeWidth}px`;
  canvas.style.height = `${safeHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const normalized = normalizeStoryOverlay(overlay);
  normalized.strokes.forEach((stroke) => {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    const first = stroke.points[0]!;
    ctx.moveTo(first.x * safeWidth, first.y * safeHeight);
    for (let index = 1; index < stroke.points.length; index += 1) {
      const point = stroke.points[index]!;
      ctx.lineTo(point.x * safeWidth, point.y * safeHeight);
    }
    ctx.stroke();
  });
}

export function splitContactAliasParts(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }
  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
  };
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error(t("Не удалось прочитать изображение")));
    };
    reader.onerror = () => reject(new Error(t("Не удалось прочитать изображение")));
    reader.readAsDataURL(file);
  });
}

export function formatSettingsSessionTime(value?: string | null) {
  if (!value) return t("неизвестно");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("неизвестно");
  return date.toLocaleString(dateLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deriveSettingsDeviceName(userAgent?: string | null) {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return t("Неизвестное устройство");
  if (ua.includes("iphone")) return "Apple iPhone";
  if (ua.includes("ipad")) return "Apple iPad";
  if (ua.includes("android")) {
    if (ua.includes("samsung") || ua.includes("sm-")) return "Samsung Galaxy";
    if (ua.includes("pixel")) return "Google Pixel";
    if (ua.includes("xiaomi") || ua.includes("redmi")) return "Xiaomi";
    if (ua.includes("huawei") || ua.includes("honor")) return "Huawei";
    return "Android Phone";
  }
  if (ua.includes("windows")) return "Windows PC";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "Apple Mac";
  if (ua.includes("linux")) return "Linux PC";
  return t("Устройство");
}

export function deriveSettingsOS(userAgent?: string | null): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return t("Неизвестная ОС");
  if (ua.includes("iphone")) {
    const match = ua.match(/iphone os ([0-9_]+)/);
    return match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS";
  }
  if (ua.includes("ipad")) {
    const match = ua.match(/os ([0-9_]+)/);
    return match ? `iPadOS ${match[1].replace(/_/g, ".")}` : "iPadOS";
  }
  if (ua.includes("android")) {
    const match = ua.match(/android ([0-9.]+)/);
    return match ? `Android ${match[1]}` : "Android";
  }
  if (ua.includes("windows nt 10.0")) return "Windows 11 / 10";
  if (ua.includes("windows nt 6.3")) return "Windows 8.1";
  if (ua.includes("windows nt 6.2")) return "Windows 8";
  if (ua.includes("windows nt 6.1")) return "Windows 7";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os x") || ua.includes("macintosh")) {
    const match = ua.match(/mac os x ([0-9_]+)/);
    return match ? `macOS ${match[1].replace(/_/g, ".")}` : "macOS";
  }
  if (ua.includes("ubuntu")) return "Ubuntu Linux";
  if (ua.includes("fedora")) return "Fedora Linux";
  if (ua.includes("arch")) return "Arch Linux";
  if (ua.includes("debian")) return "Debian Linux";
  if (ua.includes("linux")) return "Linux";
  return t("Другая ОС");
}

export function deriveSettingsBrowser(userAgent?: string | null): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return t("Браузер");
  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("opr/") || ua.includes("opera/")) return "Opera";
  if (ua.includes("yabrowser/")) return t("Яндекс Браузер");
  if (ua.includes("chrome/") && !ua.includes("edg/") && !ua.includes("opr/")) return "Google Chrome";
  if (ua.includes("firefox/")) return "Mozilla Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Apple Safari";
  return t("Веб-браузер");
}

export async function ensurePusherScript() {
  const existing = (window as Window & { Pusher?: PusherFactory }).Pusher;
  if (existing) {
    return existing;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.pusher.com/8.4.0/pusher.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t("Не удалось загрузить realtime SDK")));
    document.head.appendChild(script);
  });

  const loaded = (window as Window & { Pusher?: PusherFactory }).Pusher;
  if (!loaded) {
    throw new Error(t("Realtime SDK не инициализирован"));
  }
  return loaded;
}

export function isImagePayload(value: string) {
  return value.startsWith("data:image/");
}

export function isAudioPayload(value: string) {
  return value.startsWith("data:audio/");
}

export function isVideoPayload(value: string) {
  return value.startsWith("data:video/");
}

export function isStoredMediaUrl(value: string) {
  return value.startsWith("/uploads/") || value.startsWith("/media/") || /^https?:\/\//i.test(value);
}

export function isTemporaryMediaUrl(value: string) {
  return value.startsWith("blob:");
}

export function isRenderableMediaUrl(value: string) {
  return isStoredMediaUrl(value) || isTemporaryMediaUrl(value);
}

export function playInGlobalMusicPlayer(url: string, label: string) {
  const safeUrl = url.trim();
  const safeLabel = label.trim() || deriveMusicLabel(url);
  if (!safeUrl) return;
  const playPayload = { url: safeUrl, label: safeLabel, title: safeLabel, userInitiated: true };
  window.dispatchEvent(
    new CustomEvent("eclipse:music-play", {
      detail: playPayload,
    }),
  );
}

export function pickSavedMessagesPalette(displayName?: string | null, link?: string | null) {
  const seedSource = `${(displayName ?? "").trim().toLowerCase()}::${(link ?? "").trim().toLowerCase()}`;
  let hash = 0;
  for (let index = 0; index < seedSource.length; index += 1) {
    hash = (hash * 31 + seedSource.charCodeAt(index)) >>> 0;
  }
  return SAVED_MESSAGES_PALETTE[hash % SAVED_MESSAGES_PALETTE.length] ?? SAVED_MESSAGES_PALETTE[1];
}

export const isAudioFile = (file: File) => {
  const type = file.type.toLowerCase();
  return type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mp3") || file.name.toLowerCase().endsWith(".m4a") || file.name.toLowerCase().endsWith(".ogg") || file.name.toLowerCase().endsWith(".wav");
};

export async function getAudioDurationMs(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration * 1000);
      URL.revokeObjectURL(url);
    });
    audio.addEventListener("error", () => {
      resolve(0);
      URL.revokeObjectURL(url);
    });
  });
}

const MESSAGE_TIME_LABEL_CACHE_MAX = 6000;
const messageTimeLabelCache = new Map<string, string>();

export function formatMessageTimeLabel(iso: string) {
  const key = iso || "";
  const cached = messageTimeLabelCache.get(key);
  if (cached) return cached;
  const target = new Date(iso || "");
  const label = Number.isNaN(target.getTime())
    ? ""
    : target.toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
      });
  if (messageTimeLabelCache.size > MESSAGE_TIME_LABEL_CACHE_MAX) {
    messageTimeLabelCache.clear();
  }
  messageTimeLabelCache.set(key, label);
  return label;
}

export function pluralizeStoryTime(value: number, forms: [string, string, string]) {
  if (dateLocale() === "en-US") return value === 1 ? forms[0] : forms[2];
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export function formatStoryPublishedAt(iso: string) {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - target.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMinutes < 1) return t("только что");
  if (diffMinutes < 60) {
    return t("{0} {1} назад", { 0: diffMinutes, 1: pluralizeStoryTime(diffMinutes, [t("минуту"), t("минуты"), t("минут")]) });
  }
  if (diffHours < 24) {
    return t("{0} {1} назад", { 0: diffHours, 1: pluralizeStoryTime(diffHours, [t("час"), t("часа"), t("часов")]) });
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTargetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfTargetDay.getTime()) / 86_400_000);
  const timeText = target.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  if (dayDiff === 1) {
    return t("Вчера в {0}", { 0: timeText });
  }
  return target.toLocaleString(dateLocale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).replace(",", dateLocale() === "ru-RU" ? " в" : " at");
}
