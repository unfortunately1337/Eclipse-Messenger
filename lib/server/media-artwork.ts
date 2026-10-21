import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";

export async function grantCommunityArtwork(url: string | null | undefined, uploaderId: string, kind: "group" | "channel", communityId: string, db: Prisma.TransactionClient = prisma, previousUrl?: string | null) {
  if (!url?.startsWith("/media/") && !url?.startsWith("/uploads/")) return;
  const key = url.startsWith("/media/") ? url.slice(7).split(/[?#]/)[0] : url.slice(1).split(/[?#]/)[0];
  const asset = await db.mediaAsset.findFirst({ where: { ownerId: uploaderId, objectKey: { in: [key, key.startsWith("media/") ? key.slice(6) : `media/${key}`] } } });
  if (!asset && url === previousUrl) return;
  if (!asset || asset.clientEncrypted || !["legacy", "public"].includes(asset.scopeType)) throw new HttpError(403, "Для аватара загрузите собственное изображение");
  await db.mediaAssetAccess.upsert({ where: { mediaAssetId_scopeType_scopeId: { mediaAssetId: asset.id, scopeType: `${kind}-artwork`, scopeId: communityId } }, create: { mediaAssetId: asset.id, scopeType: `${kind}-artwork`, scopeId: communityId }, update: {} });
}
