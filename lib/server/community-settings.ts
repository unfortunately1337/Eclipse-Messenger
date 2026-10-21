import { z } from "zod";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { linkSchema } from "@/lib/server/validation";
import { grantCommunityArtwork } from "@/lib/server/media-artwork";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { triggerRealtimeChannels, userPrivateChannel } from "@/lib/server/realtime";

import { canonicalReaction, normalizeAllowedReactions } from "@/lib/reaction-policy";

export const communitySettingsSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  avatarUrl: z.string().trim().min(1).max(3_000_000).nullable().optional(),
  isPublic: z.boolean().optional(),
  link: linkSchema.optional(),
  reactionMode: z.enum(["all", "some", "none"]).optional(),
  allowedReactions: z.array(z.string().max(16).refine(emoji => Boolean(canonicalReaction(emoji)), "Unsupported reaction")).max(100).transform(normalizeAllowedReactions).optional(),
});

export async function assertCommunityLinkAvailable(tx: Prisma.TransactionClient, link: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-username:${link}`}, 0))`;
  const [userTaken, groupTaken, channelTaken] = await Promise.all([
    tx.user.findFirst({ where: { OR: ["link", "link2", "link3", "link4", "link5"].map(key => ({ [key]: { equals: link, mode: "insensitive" as const } })) }, select: { id: true } }),
    tx.group.findUnique({ where: { link }, select: { id: true } }),
    tx.channel.findUnique({ where: { link }, select: { id: true } }),
  ]);
  if (userTaken || groupTaken || channelTaken) throw new HttpError(409, "Это уникальное имя уже занято");
}

export async function updateCommunitySettings(kind: "group" | "channel", userId: string, link: string, payload: z.infer<typeof communitySettingsSchema>) {
  if (!Object.keys(payload).length) throw new HttpError(400, "Нет данных для обновления");
  const result = await prisma.$transaction(async (tx) => {
    const entity = kind === "group"
      ? await tx.group.findUnique({ where: { link } })
      : await tx.channel.findUnique({ where: { link } });
    if (!entity) throw new HttpError(404, kind === "group" ? "Группа не найдена" : "Канал не найден");
    const member = kind === "group"
      ? await tx.groupMember.findUnique({ where: { groupId_userId: { groupId: entity.id, userId } } })
      : await tx.channelSubscriber.findUnique({ where: { channelId_userId: { channelId: entity.id, userId } } });
    const owner = entity.ownerId === userId;
    if (!owner && !member) throw new HttpError(403, "У вас нет доступа к настройкам");
    if ((payload.name !== undefined || payload.description !== undefined) && !owner && !(member?.role === "admin" && member.canChangeName)) {
      throw new HttpError(403, "У вас нет прав на изменение названия и описания");
    }
    if (payload.avatarUrl !== undefined && !owner && !(member?.role === "admin" && member.canChangeAvatar)) {
      throw new HttpError(403, "У вас нет прав на изменение аватара");
    }
    if ((payload.isPublic !== undefined || payload.link !== undefined) && !owner) {
      throw new HttpError(403, "Только владелец может менять тип и уникальное имя");
    }
    if ((payload.reactionMode !== undefined || payload.allowedReactions !== undefined) && !owner && !(member?.role === "admin" && member.canChangeReactions)) {
      throw new HttpError(403, "У вас нет прав на изменение реакций");
    }
    const reactionMode = payload.reactionMode ?? entity.reactionMode;
    const allowedReactions = payload.allowedReactions ?? entity.allowedReactions;
    if (reactionMode === "some" && allowedReactions.length === 0) throw new HttpError(400, "Выберите хотя бы одну реакцию");
    const isPublic = payload.isPublic ?? entity.isPublic;
    const nextLink = isPublic ? (payload.link ?? (entity.isPublic ? entity.link : "")) : (payload.isPublic === false ? entity.id : entity.link);
    if (isPublic && !linkSchema.safeParse(nextLink).success) throw new HttpError(400, "Укажите уникальное имя");
    if (payload.link !== undefined && !isPublic) throw new HttpError(400, "Уникальное имя доступно только для публичных чатов");
    if (nextLink !== entity.link) {
      await assertCommunityLinkAvailable(tx, nextLink);
    }
    if (payload.avatarUrl !== undefined) await grantCommunityArtwork(payload.avatarUrl, userId, kind, entity.id, tx, entity.avatarUrl);
    const data = {
      ...(payload.reactionMode !== undefined ? { reactionMode } : {}),
      ...(payload.allowedReactions !== undefined ? { allowedReactions } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined ? { description: payload.description || null } : {}),
      ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
      ...((payload.isPublic !== undefined || payload.link !== undefined) ? { isPublic, link: nextLink } : {}),
    };
    const updated = kind === "group"
      ? await tx.group.update({ where: { id: entity.id }, data })
      : await tx.channel.update({ where: { id: entity.id }, data });
    const members = kind === "group"
      ? await tx.groupMember.findMany({ where: { groupId: entity.id }, select: { userId: true } })
      : await tx.channelSubscriber.findMany({ where: { channelId: entity.id }, select: { userId: true } });
    return { updated, previousLink: entity.link, recipients: [...new Set([entity.ownerId, ...members.map(member => member.userId)])] };
  });
  await invalidateChatListPayloadCache(result.recipients);
  after(async () => {
    try {
      await triggerRealtimeChannels({ channels: result.recipients.map(userPrivateChannel), name: `${kind}:updated`,
        data: { ...result.updated, previousLink: result.previousLink } });
    } catch (error) { console.warn("Community update notification failed:", error); }
  });
  return result.updated;
}
