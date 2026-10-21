import { Lock, EyeOff, Bot, Flame, KeySquare, HatGlasses, Sparkles, Ghost, ClockFading } from "lucide-react";
import type { SettingsPrivacyState, ChatUiSettings, LiveBackgroundNeatPreset } from "./types";

export const SECRET_CHAT_GRADIENTS = [
  "linear-gradient(135deg, #FF512F 0%, #DD2476 100%)",
  "linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)",
  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "linear-gradient(135deg, #F857A6 0%, #FF5858 100%)",
  "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
  "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
  "linear-gradient(135deg, #b92b27 0%, #1565c0 100%)",
  "linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)",
  "linear-gradient(135deg, #d33f49 0%, #d7c0d0 100%)",
  "linear-gradient(135deg, #12c2e9 0%, #c471ed 100%, #f64f59 100%)",
];

export const SECRET_CHAT_ICONS = [
  Lock,
  EyeOff,
  Bot,
  Flame,
  KeySquare,
  HatGlasses,
  Sparkles,
  Ghost,
  ClockFading,
];

export const DEFAULT_SETTINGS_PRIVACY: SettingsPrivacyState = {
  onlineVisibility: "all",
  lastSeenVisibility: "all",
  showTyping: true,
  showMediaActivity: true,
  showReadReceipts: true,
  allowUsernameSearch: true,
  showInGlobalSearch: true,
  allowProfileLink: true,
  allowGroupAdd: true,
  firstMessagePolicy: "all",
  newChatAutoDeleteDays: null,
  autoDeleteReadMessages: false,
  hideUsername: false,
  presenceExceptionUserIds: [],
};

export const SETTINGS_PRIVACY_DETAIL_TITLES: Record<string, string> = {
  onlineVisibility: "Кто видит мою активность",
  lastSeenVisibility: "Кто видит мою активность",
  lastSeenExceptions: "Исключения",
  showTyping: "Статус «печатает»",
  showMediaActivity: "Отправка медиа",
  showReadReceipts: "Прочтение сообщений",
  allowUsernameSearch: "Поиск по username",
  showInGlobalSearch: "Глобальный поиск",
  allowProfileLink: "Добавление по ссылке",
  allowGroupAdd: "Добавление в группы",
  firstMessagePolicy: "Новые сообщения",
  newChatAutoDeleteDays: "Удаление новых чатов",
  autoDeleteReadMessages: "Удаление прочитанного",
};

export const DEFAULT_CHAT_UI_SETTINGS: ChatUiSettings = {
  animateMessages: true,
  sendOnEnter: true,
  autoFollowLatest: true,
};

export const SETTINGS_LIVE_PRESETS: Array<{ id: LiveBackgroundNeatPreset; label: string; colors: string; icon: string }> = [
  { id: "none", label: "Стандарт", colors: "linear-gradient(135deg,#ffffff,#e4e4e7)", icon: "⚙️" },
  { id: "neon", label: "Неон", colors: "linear-gradient(135deg,#8b5cf6,#a855f7)", icon: "🏠" },
  { id: "emerald", label: "Изумруд", colors: "linear-gradient(135deg,#22c55e,#16a34a)", icon: "🐥" },
  { id: "ocean", label: "Океан", colors: "linear-gradient(135deg,#38bdf8,#0284c7)", icon: "💎" },
  { id: "midnight", label: "Полночь", colors: "linear-gradient(135deg,#6366f1,#4f46e5)", icon: "☃️" },
  { id: "sunset", label: "Закат", colors: "linear-gradient(135deg,#f97316,#ea580c)", icon: "🔥" },
  { id: "aurora", label: "Аврора", colors: "linear-gradient(135deg,#10b981,#059669)", icon: "🌌" },
  { id: "violet", label: "Фиолетовый", colors: "linear-gradient(135deg,#a855f7,#9333ea)", icon: "✨" },
  { id: "crimson", label: "Багровый", colors: "linear-gradient(135deg,#f43f5e,#e11d48)", icon: "🍎" },
  { id: "mono", label: "Моно", colors: "linear-gradient(135deg,#9ca3af,#4b5563)", icon: "🐼" },
  { id: "frost", label: "Иней", colors: "linear-gradient(135deg,#38bdf8,#818cf8)", icon: "❄️" },
  { id: "lava", label: "Лава", colors: "linear-gradient(135deg,#ef4444,#dc2626)", icon: "💥" },
];

export const REACTION_EMOJIS = [
  "\u2764\uFE0F",
  "\u{1F4A9}",
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F525}",
];

export const QUICK_HOVER_REACTIONS = [
  "\u2764\uFE0F",
  "\u{1F621}",
  "\u{1F602}",
  "\u{1F62D}",
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F525}",
  "\u{1F970}",
  "\u{1F389}",
  "\u{1F4A9}",
  "\u{1F44F}",
  "\u{1F64F}",
  "\u{1F631}",
  "\u{1F914}",
];

export { AVAILABLE_REACTIONS as ALL_AVAILABLE_REACTIONS } from "@/lib/reaction-policy";

export const MEDIA_UPLOAD_CONCURRENCY = 4;

export const STORY_OVERLAY_STROKE_WIDTH = 3;
export const STORY_OVERLAY_ERASER_THRESHOLD = 0.03;
export const STORY_TEXT_MIN_SIZE = 12;
export const STORY_TEXT_MAX_SIZE = 160;
export const STORY_TEXT_DEFAULT_SIZE = 36;
export const STORY_MEDIA_MIN_SCALE = 0.18;
export const STORY_MEDIA_MAX_SCALE = 6;
export const STORY_MEDIA_MAX_OFFSET = 1.35;

export const STORY_OVERLAY_PRESET_COLORS = [
  "#000000",
  "#222222",
  "#ff4d4f",
  "#ff2d55",
  "#ff9500",
  "#ffd60a",
  "#34c759",
  "#30d158",
  "#5ac8fa",
  "#0a84ff",
  "#5856d6",
  "#af52de",
  "#bf5af2",
  "#f2f2f7",
  "#ffffff",
] as const;

export const AUDIO_MAX_BYTES = 100 * 1024 * 1024;
export const AUDIO_MAX_DURATION_MS = 10 * 60 * 1000;

export const SAVED_MESSAGES_PALETTE = [
  ["#f7c04a", "#f59e0b"],
  ["#ef6fa8", "#db2777"],
  ["#57c7d4", "#0891b2"],
];


export const STICKER_CATALOG = [
  "/stickers/hallo.json",
  "/stickers/puga-fun.json",
  "/stickers/puga-laughing.json",
  "/stickers/puga-sleep1.json",
  "/stickers/puga-comp-1.json",
  "/stickers/puga-crying.json",
  "/stickers/puga-run-3.json",
  "/stickers/coffee.json",
  "/stickers/puga-relax.json",
  "/stickers/puga-ananas.json",
  "/stickers/puga-cool.json",
];

import { TELEGRAM_COMPOSER_EMOJIS } from "@/lib/client/telegram-emoji-gifs";

export const COMPOSER_EMOJIS = TELEGRAM_COMPOSER_EMOJIS;

export const RECORD_START_SWIPE_UP_PX = 22;
export const VOICE_CANCEL_THRESHOLD_PX = 72;
export const VOICE_LOCK_THRESHOLD_PX = 72;
export const VOICE_MAX_DURATION_MS = 600_000;
export const VOICE_MAX_BYTES = 12_000_000;
export const VIDEO_MAX_DURATION_MS = 60_000;
export const VIDEO_MAX_BYTES = 12_000_000;
export const IMAGE_MAX_BYTES = 100 * 1024 * 1024;
export const CHAT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
