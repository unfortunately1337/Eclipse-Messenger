import { prisma } from "@/lib/server/prisma";
import fs from "fs";
import path from "path";

const LOCAL_MEDIA_DIR = path.resolve(process.cwd(), ".data", "media");

const uploadedAtCache = new Map<string, Date | null>();
const MAX_CACHE_SIZE = 5000;

export async function getMediaUploadedAt(urlOrKey?: string | null): Promise<Date | null> {
  if (!urlOrKey) return null;
  const cleanKey = urlOrKey.replace(/^\/?media\//, "").split("?")[0];
  if (!cleanKey) return null;

  if (uploadedAtCache.has(cleanKey)) {
    return uploadedAtCache.get(cleanKey)!;
  }

  const candidateKeys = [
    cleanKey,
    `media/${cleanKey}`,
    cleanKey.replace(/^media\//, ""),
  ];

  let result: Date | null = null;
  try {
    const asset = await prisma.mediaAsset.findFirst({
      where: { objectKey: { in: candidateKeys } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (asset?.createdAt) {
      result = asset.createdAt;
    }
  } catch {}

  if (!result) {
    // Fallback to local file stat if stored locally
    for (const k of candidateKeys) {
      const safeFilename = k.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = path.join(LOCAL_MEDIA_DIR, safeFilename);
      if (fs.existsSync(filePath)) {
        try {
          const stat = await fs.promises.stat(filePath);
          result = stat.birthtime || stat.mtime;
          break;
        } catch {}
      }
    }
  }

  if (uploadedAtCache.size >= MAX_CACHE_SIZE) {
    const firstKey = uploadedAtCache.keys().next().value;
    if (firstKey) uploadedAtCache.delete(firstKey);
  }
  uploadedAtCache.set(cleanKey, result);

  return result;
}
