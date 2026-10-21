import { prisma } from "./prisma";
import { HttpError } from "./http";
import { deleteMediaObject } from "./media-storage";

export function localMediaKeys(url: string) {
  const path = url.trim().split(/[?#]/, 1)[0];
  const key = path.startsWith("/media/") ? path.slice(7) : path.startsWith("/uploads/") ? path.slice(1) : null;
  if (!key || key.includes("\\") || key.split("/").some(part => !part || part === "." || part === "..")) return null;
  return [...new Set([key, key.startsWith("media/") ? key.slice(6) : `media/${key}`])];
}

export async function requireOwnedPublicMedia(url: string, ownerId: string, kind?: "image" | "video") {
  const keys = localMediaKeys(url);
  if (!keys) throw new HttpError(400, "Загрузите файл в мессенджер");
  const asset = await prisma.mediaAsset.findFirst({ where: { ownerId, objectKey: { in: keys } } });
  if (!asset || asset.status !== "ready" || asset.clientEncrypted || !["legacy", "public"].includes(asset.scopeType)
    || (asset.expiresAt && asset.expiresAt.getTime() <= Date.now()) || (kind && asset.kind !== kind)) {
    throw new HttpError(403, "Используйте собственный загруженный файл подходящего типа");
  }
  return asset;
}

// Legacy URLs are untrusted too. Never delete a file merely because a profile or story named it.
export async function deleteUnusedOwnedPublicMedia(url: string, ownerId: string) {
  const keys = localMediaKeys(url);
  if (!keys) return;
  const asset = await prisma.mediaAsset.findFirst({ where: { ownerId, objectKey: { in: keys }, scopeType: { in: ["legacy", "public"] }, clientEncrypted: false, status: "ready", accessGrants: { none: {} } } });
  if (!asset?.bucket || !asset.objectKey) return;
  const urls = keys.flatMap(key => [`/media/${key}`, ...(key.startsWith("uploads/") ? [`/${key}`] : [])]);
  const references = await Promise.all([
    prisma.user.findFirst({ where: { OR: ["avatarUrl", "backgroundUrl", "musicUrl", "musicCoverUrl"].flatMap(field => urls.map(value => ({ [field]: { startsWith: value } }))) }, select: { id: true } }),
    prisma.group.findFirst({ where: { OR: urls.map(value => ({ avatarUrl: { startsWith: value } })) }, select: { id: true } }),
    prisma.channel.findFirst({ where: { OR: urls.map(value => ({ avatarUrl: { startsWith: value } })) }, select: { id: true } }),
    prisma.story.findFirst({ where: { OR: urls.map(value => ({ mediaUrl: { startsWith: value } })) }, select: { id: true } }),
    prisma.conversationParticipant.findFirst({ where: { OR: urls.map(value => ({ wallpaperUrl: { startsWith: value } })) }, select: { id: true } }),
    prisma.groupMessage.findFirst({ where: { OR: urls.map(value => ({ text: { contains: value } })) }, select: { id: true } }),
    prisma.channelPost.findFirst({ where: { OR: urls.map(value => ({ text: { contains: value } })) }, select: { id: true } }),
  ]);
  if (references.some(Boolean)) return;
  await deleteMediaObject(asset.bucket, asset.objectKey);
  await prisma.mediaAsset.deleteMany({ where: { id: asset.id, ownerId } });
}
