export function normalizeMediaPreview(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1600) return;
  return /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;
}
