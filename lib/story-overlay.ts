import { normalizeStoryFont, type StoryFont } from "./story-fonts";

export type StoryOverlayTextLayer = {
  id: string;
  text: string;
  x: number; // 0..1
  y: number; // 0..1
  color: string;
  size: number;
  font?: StoryFont;
  align?: "left" | "center" | "right";
  bgStyle?: "none" | "badge" | "inverted";
  kind?: "text" | "emoji";
};

export type StoryOverlayStrokePoint = {
  x: number; // 0..1
  y: number; // 0..1
};

export type StoryOverlayStroke = {
  id: string;
  color: string;
  width: number;
  points: StoryOverlayStrokePoint[];
};

export type StoryMediaTransform = {
  scale: number;
  x: number; // -0.45..0.45, relative translate
  y: number; // -0.45..0.45, relative translate
  bgColor?: string;
};

export type StoryOverlay = {
  media?: StoryMediaTransform;
  texts: StoryOverlayTextLayer[];
  strokes: StoryOverlayStroke[];
};

const EMPTY_OVERLAY: StoryOverlay = { texts: [], strokes: [] };

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeStoryOverlay(value: unknown): StoryOverlay {
  if (!value || typeof value !== "object") return EMPTY_OVERLAY;
  const raw = value as { media?: unknown; texts?: unknown; strokes?: unknown };

  const media = (() => {
    if (!raw.media || typeof raw.media !== "object") return undefined;
    const transform = raw.media as Partial<StoryMediaTransform>;
      const scale = clampRange(Number(transform.scale), 0.18, 6);
      const bgColor = isColor(transform.bgColor) ? transform.bgColor.trim() : undefined;
      return {
        scale,
        x: clampRange(Number(transform.x), -1.35, 1.35),
        y: clampRange(Number(transform.y), -1.35, 1.35),
      ...(bgColor ? { bgColor } : {}),
    } satisfies StoryMediaTransform;
  })();

  const texts: StoryOverlayTextLayer[] = [];
  if (Array.isArray(raw.texts)) {
    for (const item of raw.texts) {
      if (!item || typeof item !== "object") continue;
      const layer = item as Partial<StoryOverlayTextLayer>;
      const text = typeof layer.text === "string" ? layer.text.trim().slice(0, 140) : "";
      if (!text) continue;
      const color = isColor(layer.color) ? layer.color.trim() : "#ffffff";
      const size = Number.isFinite(layer.size) ? Math.max(8, Math.min(384, Number(layer.size))) : 36;
      const id = typeof layer.id === "string" && layer.id ? layer.id : `text-${Math.random().toString(36).slice(2)}`;
      const align = layer.align === "left" || layer.align === "right" ? layer.align : "center";
      const bgStyle = layer.bgStyle === "badge" || layer.bgStyle === "inverted" ? layer.bgStyle : "none";
      texts.push({
        id,
        text,
        x: clampUnit(Number(layer.x)),
        y: clampUnit(Number(layer.y)),
        color,
        size,
        ...(layer.kind !== "emoji" ? { font: normalizeStoryFont(layer.font) } : {}),
        align,
        bgStyle,
        ...(layer.kind === "emoji" ? { kind: "emoji" as const } : {}),
      });
    }
  }

  const strokes: StoryOverlayStroke[] = [];
  if (Array.isArray(raw.strokes)) {
    for (const item of raw.strokes) {
      if (!item || typeof item !== "object") continue;
      const stroke = item as Partial<StoryOverlayStroke>;
      const color = isColor(stroke.color) ? stroke.color.trim() : "#ffffff";
      const width = Number.isFinite(stroke.width) ? Math.max(1, Math.min(32, Number(stroke.width))) : 4;
      const id = typeof stroke.id === "string" && stroke.id ? stroke.id : `stroke-${Math.random().toString(36).slice(2)}`;
      const points: StoryOverlayStrokePoint[] = [];
      if (Array.isArray(stroke.points)) {
        for (const point of stroke.points) {
          if (!point || typeof point !== "object") continue;
          const p = point as Partial<StoryOverlayStrokePoint>;
          points.push({
            x: clampUnit(Number(p.x)),
            y: clampUnit(Number(p.y)),
          });
        }
      }
      if (points.length < 1) continue;
      strokes.push({ id, color, width, points });
    }
  }

  return { ...(media ? { media } : {}), texts, strokes };
}

export function parseStoryOverlay(value: string | null | undefined): StoryOverlay | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    const normalized = normalizeStoryOverlay(parsed);
    if (!normalized.media && normalized.texts.length === 0 && normalized.strokes.length === 0) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function stringifyStoryOverlay(value: unknown): string | null {
  const normalized = normalizeStoryOverlay(value);
  if (!normalized.media && normalized.texts.length === 0 && normalized.strokes.length === 0) {
    return null;
  }
  return JSON.stringify(normalized);
}
