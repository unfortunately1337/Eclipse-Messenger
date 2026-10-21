import { readJsonBody } from "@/lib/server/request-body";
import { updateCommunityRole } from "@/lib/server/community-roles";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { getContactsMap } from "@/lib/server/contacts";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { getPrivacyDisplayName, getPrivacySettings, getPrivacySettingsBatch } from "@/lib/server/privacy-settings";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { revokeGroupSharedKeysForMember } from "@/lib/server/e2e-shared-member";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { normalizeLink } from "@/lib/server/validation";
import { getMediaUploadedAt } from "@/lib/server/media-meta";

type Params = {
  params: Promise<{ link: string }>;
};

const bodySchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(200),
});
const rolePatchSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["member", "admin"]).optional(),
  roleLabel: z.string().trim().max(40).optional(),
  canChangeAvatar: z.boolean().optional(),
  canChangeName: z.boolean().optional(),
  canChangeReactions: z.boolean().optional(),
  canPinMessages: z.boolean().optional(),
  canDeleteForeignMessages: z.boolean().optional(),
  canAddMembers: z.boolean().optional(),
  canPostMessages: z.boolean().optional(),
  canGenerateInviteLink: z.boolean().optional(),
  canManageAdmins: z.boolean().optional(),
});
const deleteBodySchema = z.object({
  memberId: z.string().min(1),
});

async function resolveGroupIdForMember(userId: string, rawLink: string) {
  const link = normalizeLink(rawLink);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      link: string;
      name: string;
      reactionMode: string;
      allowedReactions: string[];
      description: string | null;
      avatarUrl: string | null;
      ownerId: string;
      isPublic: boolean;
      createdAt: Date;
      updatedAt: Date;
      myRole: string;
      myRoleLabel: string | null;
      myCanChangeAvatar: boolean;
      myCanChangeName: boolean;
      myCanChangeReactions: boolean;
      myCanPinMessages: boolean;
      myCanDeleteForeignMessages: boolean;
      myCanAddMembers: boolean;
      myCanPostMessages: boolean;
      myCanGenerateInviteLink: boolean;
      myCanManageAdmins: boolean;
    }>
  >`
    SELECT
      g."id",
      g."link",
      g."name",
      g."reactionMode",
      g."allowedReactions",
      g."description",
      g."avatarUrl",
      g."ownerId",
      g."isPublic",
      g."createdAt",
      g."updatedAt",
      gm."role" AS "myRole",
      gm."roleLabel" AS "myRoleLabel",
      gm."canChangeAvatar" AS "myCanChangeAvatar",
      gm."canChangeName" AS "myCanChangeName",
      gm."canChangeReactions" AS "myCanChangeReactions",
      gm."canPinMessages" AS "myCanPinMessages",
      gm."canDeleteForeignMessages" AS "myCanDeleteForeignMessages",
      gm."canAddMembers" AS "myCanAddMembers",
      gm."canPostMessages" AS "myCanPostMessages",
      gm."canGenerateInviteLink" AS "myCanGenerateInviteLink",
      gm."canManageAdmins" AS "myCanManageAdmins"
    FROM "Group" g
    JOIN "GroupMember" gm ON gm."groupId" = g."id"
    WHERE g."link" = ${link} AND gm."userId" = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const group = await resolveGroupIdForMember(user.id, link);
    if (!group) {
      throw new HttpError(403, "Вы не состоите в этой группе");
    }

    const groupAvatarUrl = group.avatarUrl ?? generateDefaultAvatarDataUrl(group.name, group.link);
    const members = await prisma.$queryRaw<
      Array<{
        id: string;
        link: string;
        displayName: string;
        avatarUrl: string | null;
        role: string;
        roleLabel: string | null;
        canChangeAvatar: boolean;
        canChangeName: boolean;
        canChangeReactions: boolean;
        canPinMessages: boolean;
        canDeleteForeignMessages: boolean;
        canAddMembers: boolean;
        canPostMessages: boolean;
        canGenerateInviteLink: boolean;
        canManageAdmins: boolean;
      }>
    >`
      SELECT
        u."id",
        u."link",
        u."displayName",
        u."avatarUrl",
        gm."role",
        gm."roleLabel",
        gm."canChangeAvatar",
        gm."canChangeName",
        gm."canChangeReactions",
        gm."canPinMessages",
        gm."canDeleteForeignMessages",
        gm."canAddMembers",
        gm."canPostMessages",
        gm."canGenerateInviteLink",
        gm."canManageAdmins"
      FROM "GroupMember" gm
      JOIN "User" u ON u."id" = gm."userId"
      WHERE gm."groupId" = ${group.id}
      ORDER BY gm."createdAt" ASC
    `;
    const [contactsMap, memberPrivacyById, avatarUploadedAt] = await Promise.all([
      getContactsMap(user.id),
      getPrivacySettingsBatch(members.map((member) => member.id)),
      group.ownerId === user.id ? getMediaUploadedAt(group.avatarUrl) : null,
    ]);

    const res = jsonOk({
      group: {
        ...group,
        createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
        updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : group.updatedAt,
        avatarUrl: groupAvatarUrl,
        avatarUploadedAt: avatarUploadedAt ? avatarUploadedAt.toISOString() : null,
        isPublic: group.isPublic,
        myRoleLabel: group.myRoleLabel,
        myCanChangeAvatar: group.myCanChangeAvatar,
        myCanChangeName: group.myCanChangeName,
        myCanChangeReactions: group.myCanChangeReactions,
        myCanPinMessages: group.myCanPinMessages,
        myCanDeleteForeignMessages: group.myCanDeleteForeignMessages,
        myCanAddMembers: group.myCanAddMembers,
        myCanPostMessages: group.myCanPostMessages,
        myCanGenerateInviteLink: group.myCanGenerateInviteLink,
        myCanManageAdmins: group.myCanManageAdmins,
      },
      members: members.map((member: (typeof members)[number]) => {
        const contact = contactsMap.get(member.id);
        const privacy = memberPrivacyById.get(member.id);
        return {
          ...member,
          displayName: contact?.alias || (privacy ? getPrivacyDisplayName(user.id, member.id, member.displayName, privacy) : member.displayName),
          isContact: Boolean(contact),
          contactAlias: contact?.alias ?? null,
          contactTag: null,
          contactTagVariant: "outline",
          roleLabel: member.roleLabel,
          canChangeAvatar: member.canChangeAvatar,
          canChangeName: member.canChangeName,
          canChangeReactions: member.canChangeReactions,
          canPinMessages: member.canPinMessages,
          canDeleteForeignMessages: member.canDeleteForeignMessages,
          canAddMembers: member.canAddMembers,
          canPostMessages: member.canPostMessages,
          canGenerateInviteLink: member.canGenerateInviteLink,
          canManageAdmins: member.canManageAdmins,
        };
      }),
    });
    res.headers.set("Cache-Control", "private, no-store");
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const group = await resolveGroupIdForMember(user.id, link);
    if (!group) {
      throw new HttpError(403, "Вы не состоите в этой группе");
    }

    const canAddMembers = group.myRole === "owner" || group.myCanAddMembers;
    if (!canAddMembers) {
      throw new HttpError(403, "Добавлять участников может только админ или владелец группы");
    }

    const body = bodySchema.parse(await readJsonBody(req, 128 * 1024));
    const contactsMap = await getContactsMap(user.id);
    const unique = Array.from(new Set(body.memberIds.filter((id) => id && id !== user.id)));
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const candidateIds = targetUsers.map((u) => u.id);
    if (candidateIds.length === 0) {
      throw new HttpError(400, "Пользователи не найдены");
    }
    const privacyByUserId = new Map(
      await Promise.all(
        candidateIds.map(async (id) => [id, await getPrivacySettings(id)] as const),
      ),
    );
    const allowed = candidateIds.filter((id) => {
      const p = privacyByUserId.get(id);
      return p?.allowGroupAdd !== false;
    });
    const inviteSuggestedUserIds = candidateIds.filter((id) => !allowed.includes(id));

    if (allowed.length === 0) {
      if (inviteSuggestedUserIds.length > 0) {
        const res = jsonOk({
          added: 0,
          skipped: 0,
          inviteSuggestedUserIds,
        });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      throw new HttpError(400, "Пользователи запретили добавление в группы");
    }

    const existing = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "GroupMember"
      WHERE "groupId" = ${group.id}
        AND "userId" = ANY(${allowed}::text[])
    `;
    const existingSet = new Set(
      existing.map((row: (typeof existing)[number]) => row.userId),
    );
    const toInsert = allowed.filter((id: (typeof allowed)[number]) => !existingSet.has(id));

    for (const memberId of toInsert) {
      const groupMemberId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "GroupMember" ("id", "groupId", "userId", "role", "createdAt")
        VALUES (${groupMemberId}, ${group.id}, ${memberId}, 'member', NOW())
      `;
    }

    const admins = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "GroupMember"
      WHERE "groupId" = ${group.id} AND ("role" IN ('owner', 'admin') OR "canAddMembers" = true)
    `;
    await Promise.all(
      admins.map(async (admin) => {
        try {
          await triggerRealtimeEvent({
            channel: userPrivateChannel(admin.userId),
            name: "group:e2e-rotate",
            data: { groupLink: group.link, groupId: group.id },
          });
        } catch {
          // ignore realtime failures
        }
      }),
    );

    await Promise.allSettled(
      toInsert.map((participantId) =>
        triggerRealtimeEvent({
          channel: userPrivateChannel(participantId),
          name: "group:added",
          data: {
            id: group.id,
            link: group.link,
            name: group.name,
            reactionMode: group.reactionMode,
            allowedReactions: group.allowedReactions,
            avatarUrl: group.avatarUrl,
            previewText: "Вы были добавлены в группу.",
          },
        }),
      ),
    );
    await invalidateChatListPayloadCache([user.id, ...toInsert]);

    const res = jsonOk({
      added: toInsert.length,
      skipped: allowed.length - toInsert.length,
      inviteSuggestedUserIds,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const group = await resolveGroupIdForMember(user.id, link);
    if (!group) {
      throw new HttpError(403, "Вы не состоите в этой группе");
    }

    const body = deleteBodySchema.parse(await readJsonBody(req, 128 * 1024));
    const isSelfLeave = body.memberId === user.id;

    if (!isSelfLeave && group.myRole !== "owner" && group.myRole !== "admin") {
      throw new HttpError(403, "Недостаточно прав для удаления участника");
    }

    if (body.memberId === group.ownerId) {
      throw new HttpError(400, "Нельзя удалить создателя группы");
    }

    const targetRows = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "GroupMember"
      WHERE "groupId" = ${group.id} AND "userId" = ${body.memberId}
      LIMIT 1
    `;
    const target = targetRows[0] ?? null;
    if (!target) {
      throw new HttpError(404, "Участник не найден в группе");
    }

    await prisma.$executeRaw`
      DELETE FROM "GroupMember"
      WHERE "groupId" = ${group.id} AND "userId" = ${body.memberId}
    `;
    await revokeGroupSharedKeysForMember(group.id, body.memberId);

    const admins = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "GroupMember"
      WHERE "groupId" = ${group.id} AND ("role" IN ('owner', 'admin') OR "canAddMembers" = true)
    `;
    await Promise.all(
      admins.map(async (admin) => {
        try {
          await triggerRealtimeEvent({
            channel: userPrivateChannel(admin.userId),
            name: "group:e2e-rotate",
            data: { groupLink: group.link, groupId: group.id, rotate: true },
          });
        } catch {
          // ignore realtime failures
        }
      }),
    );

    const res = jsonOk({ removed: true, memberId: body.memberId });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const payload = rolePatchSchema.parse(await readJsonBody(req, 128 * 1024));
    const group = await updateCommunityRole("group", user.id, link, payload);
    const { role: targetRole, roleLabel } = group;

    const groupMembers = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId" FROM "GroupMember" WHERE "groupId" = ${group.id}
    `;
    await Promise.allSettled(
      groupMembers.map((m) =>
        triggerRealtimeEvent({
          channel: userPrivateChannel(m.userId),
          name: "group:role-updated",
          data: {
            groupId: group.id,
            groupLink: group.link,
            memberId: payload.memberId,
            role: targetRole,
            roleLabel,
            canChangeReactions: group.canChangeReactions,
            canPinMessages: group.canPinMessages,
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
