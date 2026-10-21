export type AudioFileMetadata = {
  title?: string;
  author?: string;
  cover?: Blob;
};

const cachedMetadata = new WeakMap<Blob, Promise<AudioFileMetadata>>();

/** Read local tags only; a broken/missing tag must never prevent sending audio. */
export function readAudioFileMetadata(file: Blob): Promise<AudioFileMetadata> {
  const cached = cachedMetadata.get(file);
  if (cached) return cached;
  const request = (async () => {
    try {
      const { parseBlob, selectCover } = await import("music-metadata");
      const { common } = await parseBlob(file, { duration: false });
      const picture = selectCover(common.picture);
      const mime = picture?.format.toLowerCase().replace("image/jpg", "image/jpeg");
      const cover = picture && mime && ["image/jpeg", "image/png", "image/webp"].includes(mime)
        && picture.data.byteLength > 0 && picture.data.byteLength <= 5 * 1024 * 1024
        ? new Blob([new Uint8Array(picture.data)], { type: mime }) : undefined;
      return {
        title: common.title?.trim().slice(0, 300) || undefined,
        author: common.artist?.trim().slice(0, 300) || undefined,
        cover,
      };
    } catch {
      return {};
    }
  })();
  cachedMetadata.set(file, request);
  return request;
}
