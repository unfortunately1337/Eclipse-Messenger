export function normalizeMediaPreview(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1600) return;
  return /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;
}

export type MediaPreviewDetails = { preview?: string; aspectRatio?: number };

export function normalizeMediaAspectRatio(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

// Earlier previews are tiny JPEGs. Their frame header still gives us a stable ratio.
export function getJpegPreviewAspectRatio(preview?: string): number | undefined {
  if (!preview?.startsWith("data:image/jpeg;base64,")) return;
  let bytes: string;
  try { bytes = atob(preview.slice("data:image/jpeg;base64,".length)); }
  catch { return; }
  const read = (i: number) => bytes.charCodeAt(i);
  const read16 = (i: number) => (read(i) << 8) | read(i + 1);
  if (read16(0) !== 0xffd8) return;
  for (let offset = 2; offset + 9 <= bytes.length && read(offset) === 0xff;) {
    const marker = read(offset + 1);
    const length = read16(offset + 2);
    if (length < 2 || marker === 0xda) return;
    if (marker >= 0xc0 && marker <= 0xc3 && length >= 8) {
      return normalizeMediaAspectRatio(read16(offset + 7) / read16(offset + 5));
    }
    offset += 2 + length;
  }
}
