/**
 * High-performance client-side media compression and security verification.
 * Optimized for instant messenger uploads and low-latency encryption.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetMimeType?: "image/webp" | "image/jpeg";
}

export interface CompressedImageResult {
  file: File;
  width: number;
  height: number;
  previewUrl: string;
}

/**
 * Checks magic bytes of common file formats to prevent malicious disguised payloads.
 */
export async function verifyFileMagicBytes(file: File): Promise<{ isValid: boolean; detectedType?: string }> {
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length < 4) {
      return { isValid: false };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return { isValid: true, detectedType: "image/png" };
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { isValid: true, detectedType: "image/jpeg" };
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { isValid: true, detectedType: "image/gif" };
    }

    // WebP / RIFF: 52 49 46 46 .... 57 45 42 50
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { isValid: true, detectedType: "image/webp" };
    }

    // MP4 / QuickTime / ISO Base Media: ....ftyp
    if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return { isValid: true, detectedType: "video/mp4" };
    }

    // Ogg / Opus: 4F 67 67 53
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return { isValid: true, detectedType: "audio/ogg" };
    }

    // MP3 with ID3 tag: 49 44 33
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return { isValid: true, detectedType: "audio/mp3" };
    }

    // MP3 without ID3 (frame sync 0xFF 0xFB/0xF3/0xF2)
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
      return { isValid: true, detectedType: "audio/mp3" };
    }

    // PDF: 25 50 44 46 (%PDF)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { isValid: true, detectedType: "application/pdf" };
    }

    // ZIP / Office docs: 50 4B 03 04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05) && (bytes[3] === 0x04 || bytes[3] === 0x06)) {
      return { isValid: true, detectedType: "application/zip" };
    }

    // For other general documents, if mimeType is set and not dangerous executable, allow
    const dangerousExtensions = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".scr", ".pif", ".hta"];
    const hasDangerousExt = dangerousExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (hasDangerousExt) {
      return { isValid: false };
    }

    return { isValid: true, detectedType: file.type || "application/octet-stream" };
  } catch {
    return { isValid: false };
  }
}

/**
 * Fast client-side image compression with bicubic resizing.
 * Downscales images over max dimensions and encodes as WebP/JPEG to minimize upload payload.
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.82;

  // Don't re-compress GIFs or small SVGs
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    const previewUrl = URL.createObjectURL(file);
    return {
      file,
      width: 0,
      height: 0,
      previewUrl,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width <= 0 || height <= 0) {
        resolve({
          file,
          width: 0,
          height: 0,
          previewUrl: URL.createObjectURL(file),
        });
        return;
      }

      // Calculate aspect-ratio preserving dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // If file is already small and within limits, keep original
      if (file.size < 200 * 1024 && width === img.width && height === img.height) {
        resolve({
          file,
          width,
          height,
          previewUrl: URL.createObjectURL(file),
        });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        resolve({
          file,
          width,
          height,
          previewUrl: URL.createObjectURL(file),
        });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Determine optimal target format (WebP is ~30-50% smaller than JPEG with identical visual quality)
      const targetMime = options.targetMimeType ?? "image/webp";

      const encodeBlob = (mime: string) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              if (mime !== "image/jpeg") {
                encodeBlob("image/jpeg");
                return;
              }
              resolve({
                file,
                width,
                height,
                previewUrl: URL.createObjectURL(file),
              });
              return;
            }

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const extension = mime === "image/webp" ? ".webp" : ".jpg";
            const compressedFile = new File([blob], `${baseName}${extension}`, {
              type: mime,
              lastModified: Date.now(),
            });

            const previewUrl = URL.createObjectURL(blob);
            resolve({
              file: compressedFile,
              width,
              height,
              previewUrl,
            });
          },
          mime,
          quality
        );
      };

      encodeBlob(targetMime);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        width: 0,
        height: 0,
        previewUrl: URL.createObjectURL(file),
      });
    };

    img.src = objectUrl;
  });
}
