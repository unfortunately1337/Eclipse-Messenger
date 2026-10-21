import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { getInvitePreview, inviteToken } from "@/lib/server/invite-preview";

type Params = { params: Promise<{ token: string }> };

// Possession of an active invite permits this limited read-only preview.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const preview = await getInvitePreview((await params).token);
    const res = jsonOk(preview);
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) { return applyCors(req, jsonError(error)); }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const token = inviteToken((await params).token);
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string; type: string; groupId: string | null; channelId: string | null; revokedAt: Date | null; expiresAt: Date | null; usageLimit: number | null; usageCount: number }>>
        `SELECT "id", "type", "groupId", "channelId", "revokedAt", "expiresAt", "usageLimit", "usageCount" FROM "InviteLink" WHERE "token" = ${token} FOR UPDATE`;
      const invite = rows[0];
      if (!invite || invite.revokedAt || (invite.expiresAt && invite.expiresAt.getTime() <= Date.now())) throw new HttpError(404, "Ссылка приглашения недействительна или срок её действия истёк");
      const group = invite.type === "group", entityId = group ? invite.groupId : invite.channelId;
      if (!entityId) throw new HttpError(404, "Ссылка приглашения недействительна");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invite-member:${invite.type}:${entityId}:${user.id}`}))`;
      const entity = group ? await tx.group.findUnique({ where: { id: entityId } }) : await tx.channel.findUnique({ where: { id: entityId } });
      if (!entity) throw new HttpError(404, "Ссылка приглашения недействительна");
      const existing = group ? await tx.groupMember.findUnique({ where: { groupId_userId: { groupId: entityId, userId: user.id } } }) : await tx.channelSubscriber.findUnique({ where: { channelId_userId: { channelId: entityId, userId: user.id } } });
      if (!existing && entity.ownerId !== user.id) {
        if (invite.usageLimit !== null && invite.usageCount >= invite.usageLimit) throw new HttpError(410, "Лимит вступлений по этой ссылке исчерпан");
        if (group) await tx.groupMember.create({ data: { id: randomUUID(), groupId: entityId, userId: user.id, role: "member" } });
        else await tx.channelSubscriber.create({ data: { id: randomUUID(), channelId: entityId, userId: user.id } });
        await tx.$executeRaw`UPDATE "InviteLink" SET "usageCount" = "usageCount" + 1 WHERE "id" = ${invite.id}`;
      }
      return { entity, type: group ? "group" : "channel", joined: !existing && entity.ownerId !== user.id };
    });
    const { entity, type, joined } = result;
    await invalidateChatListPayloadCache(user.id);
    if (joined) {
      await invalidateChatListPayloadCache(entity.ownerId);
      try {
        await triggerRealtimeEvent({ channel: userPrivateChannel(user.id), name: `${type}:added`, data: { id: entity.id, link: entity.link, name: entity.name, avatarUrl: entity.avatarUrl, createdAt: entity.createdAt.toISOString(), previewText: type === "group" ? "Вы вступили в группу" : "Вы подписались на канал" } });
        await triggerRealtimeEvent({ channel: userPrivateChannel(entity.ownerId), name: `${type}:e2e-rotate`, data: type === "group" ? { groupId: entity.id, groupLink: entity.link } : { channelId: entity.id, channelLink: entity.link } });
      } catch { /* Joining remains successful if realtime delivery is unavailable. */ }
    }
    const res = jsonOk({ type, link: entity.link }); ensureCsrfCookie(req, res); return applyCors(req, res);
  } catch (error) { return applyCors(req, jsonError(error)); }
}
export function OPTIONS(req: NextRequest) { return handleOptions(req); }
