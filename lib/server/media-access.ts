import { NextRequest } from "next/server";
import { requireUserFromRequest } from "./auth";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { requireMediaScope } from "./media-scope";

export async function requireMediaAccess(req: NextRequest, objectKey: string) {
  const candidates = [...new Set([objectKey, objectKey.startsWith("media/") ? objectKey.slice(6) : `media/${objectKey}`])];
  const asset = await prisma.mediaAsset.findFirst({ where: { objectKey: { in: candidates } } });
  if (!asset || asset.status !== "ready" || (asset.expiresAt && asset.expiresAt.getTime() <= Date.now())) throw new HttpError(404, "Файл недоступен");
  if (asset.scopeType !== "legacy" && asset.scopeType !== "public") {
    const { user, sessionId } = await requireUserFromRequest(req);
    await requireMediaScope(asset, user.id, sessionId);
    return asset;
  }
  const urls = candidates.flatMap(key => [`/media/${key}`, ...(key.startsWith("uploads/") ? [`/${key}`] : [])]);
  const grants = await prisma.mediaAssetAccess.findMany({ where: { mediaAssetId: asset.id } });
  const groupArtworkIds = grants.filter(grant => grant.scopeType === "group-artwork").map(grant => grant.scopeId);
  const channelArtworkIds = grants.filter(grant => grant.scopeType === "channel-artwork").map(grant => grant.scopeId);
  const [profile, group, channel] = await Promise.all([
    prisma.user.findFirst({
      where: { id: asset.ownerId, OR: [{ avatarUrl: { in: urls } }, { backgroundUrl: { in: urls } }, { musicUrl: { in: urls } }, { musicCoverUrl: { in: urls } }] },
      select: { id: true },
    }),
    prisma.group.findFirst({ where: { avatarUrl: { in: urls }, isPublic: true, OR: [{ ownerId: asset.ownerId }, { id: { in: groupArtworkIds } }] }, select: { id: true } }),
    prisma.channel.findFirst({ where: { avatarUrl: { in: urls }, isPublic: true, OR: [{ ownerId: asset.ownerId }, { id: { in: channelArtworkIds } }] }, select: { id: true } }),
  ]);
  if (profile || group || channel) return asset;
  const { user } = await requireUserFromRequest(req);
  if (asset.ownerId === user.id) return asset;
  if (grants.length) {
    const { sessionId } = await requireUserFromRequest(req);
    for (const grant of grants) {
      try { await requireMediaScope({ ...grant, expiresAt: null }, user.id, sessionId); return asset; }
      catch (error) { if (!(error instanceof HttpError) || error.status >= 500) throw error; }
    }
  }
  const story = await prisma.story.findFirst({ where: { authorId: asset.ownerId, mediaUrl: { in: urls }, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (story) {
    const contact = await prisma.contact.findFirst({ where: { ownerId: user.id, peerId: asset.ownerId }, select: { id: true } });
    const conversation = await prisma.conversation.findFirst({ where: { type: "direct", AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: asset.ownerId } } }] }, select: { id: true } });
    if (contact || conversation) return asset;
  }
  const artwork = await prisma.group.findFirst({ where: { avatarUrl: { in: urls }, OR: [{ ownerId: asset.ownerId }, { id: { in: groupArtworkIds } }], members: { some: { userId: user.id } } }, select: { id: true } });
  const channelArtwork = await prisma.channel.findFirst({ where: { avatarUrl: { in: urls }, AND: [{ OR: [{ ownerId: asset.ownerId }, { id: { in: channelArtworkIds } }] }, { OR: [{ ownerId: user.id }, { subscribers: { some: { userId: user.id } } }] }] }, select: { id: true } });
  if (artwork || channelArtwork) return asset;
  throw new HttpError(403, "Нет доступа к файлу");
}
