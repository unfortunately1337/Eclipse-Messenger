import { readJsonBody } from "@/lib/server/request-body";
import { updateCommunityRole } from "@/lib/server/community-roles";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { normalizeLink } from "@/lib/server/validation";

type Params = {
  params: Promise<{ link: string }>;
};

const bodySchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(200),
});

async function resolveAddMembersChannel(userId: string, rawLink: string) {
  const link = normalizeLink(rawLink);
  const rows = await prisma.$queryRaw<
    Array<{ id: string; link: string; name: string; avatarUrl: string | null; ownerId: string; createdAt: Date; role: string; canAddMembers: boolean }>
  >`
    SELECT c."id", c."link", c."name", c."avatarUrl", c."ownerId", c."createdAt", cs."role", cs."canAddMembers"
    FROM "Channel" c
    LEFT JOIN "ChannelSubscriber" cs ON cs."channelId" = c."id" AND cs."userId" = ${userId}
    WHERE c."link" = ${link}
    LIMIT 1
  `;
  const channel = rows[0] ?? null;
  if (!channel) return null;
  const isOwner = channel.ownerId === userId;
  const canAdd = isOwner || (channel.role === "admin" && channel.canAddMembers);
  if (!canAdd) return null;
  return channel;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const channel = await resolveAddMembersChannel(user.id, link);
    if (!channel) {
      throw new HttpError(403, "Нет доступа к каналу");
    }

    const body = bodySchema.parse(await readJsonBody(req, 128 * 1024));
    const unique = Array.from(new Set(body.memberIds.filter((id) => id && id !== user.id)));
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const candidateIds = targetUsers.map((u) => u.id);
    if (candidateIds.length === 0) {
      throw new HttpError(400, "Пользователи не найдены");
    }

    const existing = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "ChannelSubscriber"
      WHERE "channelId" = ${channel.id}
        AND "userId" = ANY(${candidateIds}::text[])
    `;
    const existingSet = new Set(existing.map((row) => row.userId));
    const toInsert = candidateIds.filter((id) => !existingSet.has(id));

    if (toInsert.length > 0) {
      await prisma.channelSubscriber.createMany({
        data: toInsert.map((memberId) => ({
          id: randomUUID(),
          channelId: channel.id,
          userId: memberId,
        })),
        skipDuplicates: true,
      });
    }

    const countRows = await prisma.$queryRaw<Array<{ value: bigint | number }>>`
      SELECT COUNT(*) AS value
      FROM "ChannelSubscriber"
      WHERE "channelId" = ${channel.id}
    `;
    const subscribersCount = String(Number(countRows[0]?.value ?? 0));

    await Promise.allSettled(
      toInsert.map((participantId) =>
        triggerRealtimeEvent({
          channel: userPrivateChannel(participantId),
          name: "channel:added",
          data: {
            id: channel.id,
            link: channel.link,
            name: channel.name,
            avatarUrl: channel.avatarUrl,
            createdAt: channel.createdAt.toISOString(),
            previewText: "Вы были добавлены.",
          },
        }),
      ),
    );
    await invalidateChatListPayloadCache([user.id, ...toInsert]);

    const res = jsonOk({
      added: toInsert.length,
      skipped: candidateIds.length - toInsert.length,
      subscribersCount,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}


const rolePatchSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["member", "admin"]).optional(),
  roleLabel: z.string().trim().max(40).optional(),
  canChangeAvatar: z.boolean().optional(),
  canChangeName: z.boolean().optional(),
  canChangeReactions: z.boolean().optional(),
  canPinMessages: z.boolean().optional(),
  canPostMessages: z.boolean().optional(),
  canEditForeignMessages: z.boolean().optional(),
  canDeleteForeignMessages: z.boolean().optional(),
  canAddMembers: z.boolean().optional(),
  canGenerateInviteLink: z.boolean().optional(),
  canManageAdmins: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const payload = rolePatchSchema.parse(await readJsonBody(req, 128 * 1024));
    const channel = await updateCommunityRole("channel", user.id, link, payload);
    const { role: targetRole, roleLabel } = channel;
    const normalizedLink = channel.link;

    const channelSubs = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId" FROM "ChannelSubscriber" WHERE "channelId" = ${channel.id}
    `;
    await Promise.allSettled(
      channelSubs.map((sub) =>
        triggerRealtimeEvent({
          channel: userPrivateChannel(sub.userId),
          name: "channel:role-updated",
          data: {
            channelId: channel.id,
            channelLink: normalizedLink,
            memberId: payload.memberId,
            role: targetRole,
            roleLabel,
            canChangeReactions: channel.canChangeReactions,
            canPinMessages: channel.canPinMessages,
          },
        }),
      ),
    );

    const res = jsonOk({ updated: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const link = normalizeLink((await params).link);
    const { memberId } = z.object({ memberId: z.string().min(1) }).parse(await readJsonBody(req, 128 * 1024));
    const result = await prisma.$transaction(async tx => {
      const channel = await tx.channel.findUnique({ where: { link }, include: { subscribers: { where: { userId: user.id } } } });
      const requester = channel?.subscribers[0];
      if (!channel || (channel.ownerId !== user.id && !(requester?.role === "admin" && requester.canAddMembers))) throw new HttpError(403, "Нет прав для удаления подписчиков");
      if (memberId === channel.ownerId) throw new HttpError(403, "Нельзя удалить создателя канала");
      const removed = await tx.channelSubscriber.deleteMany({ where: { channelId: channel.id, userId: memberId } });
      if (!removed.count) throw new HttpError(404, "Подписчик не найден");
      await tx.channelE2EKeyMember.deleteMany({ where: { userId: memberId, channelKey: { channelId: channel.id } } });
      return channel;
    });
    await Promise.all([invalidateChatListPayloadCache(memberId), invalidateChatListPayloadCache(result.ownerId)]);
    try {
      await triggerRealtimeEvent({ channel: userPrivateChannel(result.ownerId), name: "channel:e2e-rotate", data: { channelLink: link, channelId: result.id, rotate: true } });
    } catch { /* Membership and key removal do not depend on realtime delivery. */ }
    const response = jsonOk({ removed: true, memberId });
    ensureCsrfCookie(req, response);
    return applyCors(req, response);
  } catch (error) { return applyCors(req, jsonError(error)); }
}
