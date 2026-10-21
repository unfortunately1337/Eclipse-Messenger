export const STORY_FONTS = [
  { id: "tiktok", label: "Обычный", family: '"TikTok Sans", Arial, sans-serif', weight: 600 },
  { id: "inter", label: "Inter", family: '"Inter", Arial, sans-serif', weight: 600 },
  { id: "roboto", label: "Roboto", family: '"Roboto", Arial, sans-serif', weight: 500 },
  { id: "outfit", label: "Outfit", family: '"Outfit", Arial, sans-serif', weight: 500 },
  { id: "nunito", label: "Nunito", family: '"Nunito", Arial, sans-serif', weight: 700 },
  { id: "arial", label: "Arial", family: 'Arial, Helvetica, sans-serif', weight: 600 },
  { id: "georgia", label: "Georgia", family: 'Georgia, "Times New Roman", serif', weight: 400 },
  { id: "times", label: "Times", family: '"Times New Roman", Times, serif', weight: 400 },
  { id: "mono", label: "Моно", family: '"Courier New", Courier, monospace', weight: 400 },
  { id: "verdana", label: "Verdana", family: 'Verdana, Geneva, sans-serif', weight: 500 },
  { id: "trebuchet", label: "Trebuchet", family: '"Trebuchet MS", Arial, sans-serif', weight: 600 },
  { id: "tahoma", label: "Tahoma", family: 'Tahoma, Verdana, sans-serif', weight: 500 },
] as const;
export type StoryFont = (typeof STORY_FONTS)[number]["id"];
export function normalizeStoryFont(value: unknown): StoryFont {
  return STORY_FONTS.find(font => font.id === value)?.id ?? "tiktok";
}
export function storyFontStyle(value: unknown) {
  const font = STORY_FONTS.find(font => font.id === value) ?? STORY_FONTS[0];
  return { fontFamily: font.family, fontWeight: font.weight };
}
