const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const emojiPattern = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;

export function storyEmojiGraphemes(text: string): string[] {
  return Array.from(segmenter.segment(text.trim()), ({ segment }) => segment).filter(part => !/^\s+$/.test(part));
}

export function singleStoryEmoji(text: string): string | null {
  const parts = storyEmojiGraphemes(text);
  return parts.length === 1 && emojiPattern.test(parts[0]) ? parts[0] : null;
}

export function storyColorToHsv(hex: string) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#ffffff";
  const [r, g, b] = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

export function storyHsvToColor(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360 / 60;
  const saturation = Math.max(0, Math.min(1, s)), value = Math.max(0, Math.min(1, v));
  const chroma = value * saturation, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = value - chroma;
  const rgb = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return "#" + rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("");
}
