export type ProfileGradientPreset = {
  id: string;
  name: string;
  gradient: string;
  accentColor: string;
  previewColors: [string, string];
  isDuoTone?: boolean;
  aliases?: string[];
};

export const PROFILE_GRADIENT_PRESETS: ProfileGradientPreset[] = [
  // ── ROW 1: Authentic Telegram Solid Colors (8 columns) ───────────────────
  {
    id: "blue",
    name: "Синий",
    gradient: "linear-gradient(180deg, #4495e1 0%, #357fc9 50%, #266aa8 100%)",
    accentColor: "#a8d4ff",
    previewColors: ["#4495e1", "#4495e1"],
    isDuoTone: false,
    aliases: ["azure"],
  },
  {
    id: "green",
    name: "Зелёный",
    gradient: "linear-gradient(180deg, #4db437 0%, #3e992b 50%, #2e7d1d 100%)",
    accentColor: "#b2f0c5",
    previewColors: ["#4db437", "#4db437"],
    isDuoTone: false,
    aliases: ["lime"],
  },
  {
    id: "orange",
    name: "Оранжевый",
    gradient: "linear-gradient(180deg, #e68630 0%, #c97124 50%, #a85815 100%)",
    accentColor: "#ffd4a8",
    previewColors: ["#e68630", "#e68630"],
    isDuoTone: false,
    aliases: ["caramel", "yellow"],
  },
  {
    id: "coral",
    name: "Красный",
    gradient: "linear-gradient(180deg, #d15353 0%, #b33f3f 50%, #8f2b2b 100%)",
    accentColor: "#ffb8ae",
    previewColors: ["#d15353", "#d15353"],
    isDuoTone: false,
    aliases: ["red", "peach", "terracotta"],
  },
  {
    id: "purple",
    name: "Фиолетовый",
    gradient: "linear-gradient(180deg, #8e59db 0%, #7644be 50%, #5d2da1 100%)",
    accentColor: "#ddb8ff",
    previewColors: ["#8e59db", "#8e59db"],
    isDuoTone: false,
    aliases: ["violet", "violet-pink"],
  },
  {
    id: "cyan",
    name: "Бирюзовый",
    gradient: "linear-gradient(180deg, #3daab8 0%, #2f8e9c 50%, #206f7b 100%)",
    accentColor: "#a0ede6",
    previewColors: ["#3daab8", "#3daab8"],
    isDuoTone: false,
    aliases: ["mint", "teal", "turquoise"],
  },
  {
    id: "pink",
    name: "Розовый",
    gradient: "linear-gradient(180deg, #c7517b 0%, #aa3e64 50%, #89284b 100%)",
    accentColor: "#ffb8d6",
    previewColors: ["#c7517b", "#c7517b"],
    isDuoTone: false,
    aliases: ["ruby", "crimson"],
  },
  {
    id: "grey",
    name: "Серый",
    gradient: "linear-gradient(180deg, #7e8b98 0%, #687480 50%, #4e5862 100%)",
    accentColor: "#d2dbe3",
    previewColors: ["#7e8b98", "#7e8b98"],
    isDuoTone: false,
    aliases: ["gray", "slate", "graphite"],
  },

  // ── ROW 2: Telegram Duotone Diagonal Gradients (8 columns) ────────────────
  {
    id: "duo-blue",
    name: "Синий градиент",
    gradient: "linear-gradient(145deg, #3a88d7 0%, #72bbf3 100%)",
    accentColor: "#a8d8ff",
    previewColors: ["#3a88d7", "#72bbf3"],
    isDuoTone: true,
    aliases: ["grad-ocean", "grad-sky"],
  },
  {
    id: "duo-green",
    name: "Зелёный градиент",
    gradient: "linear-gradient(145deg, #22981b 0%, #79cb39 100%)",
    accentColor: "#bcf5a8",
    previewColors: ["#22981b", "#79cb39"],
    isDuoTone: true,
    aliases: ["grad-forest"],
  },
  {
    id: "duo-orange",
    name: "Оранжевый градиент",
    gradient: "linear-gradient(145deg, #d76d1e 0%, #f5b62b 100%)",
    accentColor: "#ffe19a",
    previewColors: ["#d76d1e", "#f5b62b"],
    isDuoTone: true,
    aliases: ["grad-amber"],
  },
  {
    id: "duo-coral",
    name: "Красный градиент",
    gradient: "linear-gradient(145deg, #cb4345 0%, #f39257 100%)",
    accentColor: "#ffd1b8",
    previewColors: ["#cb4345", "#f39257"],
    isDuoTone: true,
    aliases: ["grad-sunset"],
  },
  {
    id: "duo-purple",
    name: "Фиолетовый градиент",
    gradient: "linear-gradient(145deg, #7847c9 0%, #df6cf2 100%)",
    accentColor: "#f3c2ff",
    previewColors: ["#7847c9", "#df6cf2"],
    isDuoTone: true,
    aliases: ["grad-aurora"],
  },
  {
    id: "duo-cyan",
    name: "Бирюзовый градиент",
    gradient: "linear-gradient(145deg, #2294b4 0%, #67dfbe 100%)",
    accentColor: "#b3fae7",
    previewColors: ["#2294b4", "#67dfbe"],
    isDuoTone: true,
  },
  {
    id: "duo-pink",
    name: "Розовый градиент",
    gradient: "linear-gradient(145deg, #be3a63 0%, #fca48c 100%)",
    accentColor: "#ffd6cc",
    previewColors: ["#be3a63", "#fca48c"],
    isDuoTone: true,
    aliases: ["grad-rose"],
  },
  {
    id: "duo-grey",
    name: "Серый градиент",
    gradient: "linear-gradient(145deg, #53626e 0%, #90a0ae 100%)",
    accentColor: "#dae5ee",
    previewColors: ["#53626e", "#90a0ae"],
    isDuoTone: true,
  },
];

export function findProfilePreset(idOrName?: string | null): ProfileGradientPreset | null {
  if (!idOrName) return null;
  const target = idOrName.trim().toLowerCase();
  return (
    PROFILE_GRADIENT_PRESETS.find(
      (p) => p.id === target || p.aliases?.includes(target)
    ) ?? null
  );
}

export function getDefaultProfilePreset(displayName: string = "", link: string = ""): ProfileGradientPreset {
  const seedSource = `${(displayName || "").trim().toLowerCase()}::${(link || "").trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    hash = (hash * 31 + seedSource.charCodeAt(i)) >>> 0;
  }
  return PROFILE_GRADIENT_PRESETS[hash % PROFILE_GRADIENT_PRESETS.length] || PROFILE_GRADIENT_PRESETS[0];
}

export function getDefaultProfileGradient(displayName: string = "", link: string = ""): string {
  return getDefaultProfilePreset(displayName, link).gradient;
}

export function getDefaultProfilePresetId(displayName: string = "", link: string = ""): string {
  return getDefaultProfilePreset(displayName, link).id;
}

export function getEffectiveProfileGradient(
  backgroundUrl?: string | null,
  displayName?: string,
  link?: string
): string | null {
  if (!backgroundUrl || backgroundUrl === "none") {
    return null;
  }
  const preset = findProfilePreset(backgroundUrl);
  if (preset) return preset.gradient;
  if (backgroundUrl.startsWith("linear-gradient") || backgroundUrl.startsWith("radial-gradient")) {
    return backgroundUrl;
  }
  return null;
}

export function isMediaBackgroundUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "none") return false;
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/media/") ||
    trimmed.startsWith("/api/media/") ||
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("uploads/") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  );
}

export function getEffectiveProfileAccentColor(
  backgroundUrl?: string | null,
  displayName?: string,
  link?: string
): string {
  if (!backgroundUrl || backgroundUrl === "none") {
    return "#a1a1aa";
  }
  const preset = findProfilePreset(backgroundUrl);
  if (preset) return preset.accentColor;
  if (isMediaBackgroundUrl(backgroundUrl)) {
    return "#a8d4ff";
  }
  return "#a1a1aa";
}
