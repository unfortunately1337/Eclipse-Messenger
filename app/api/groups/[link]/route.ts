import { readJsonBody } from "@/lib/server/request-body";
import { communitySettingsSchema, updateCommunitySettings } from "@/lib/server/community-settings";
import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { normalizeLink } from "@/lib/server/validation";

type Params = {
  params: Promise<{ link: string }>;
};


export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;
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
        createdAt: Date;
        membersCount: bigint | number;
        isPublic: boolean;
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
        g."createdAt",
        COUNT(gm."id") AS "membersCount",
        g."isPublic"
      FROM "Group" g
      LEFT JOIN "GroupMember" gm ON gm."groupId" = g."id"
      WHERE g."link" = ${link}
      GROUP BY g."id"
      LIMIT 1
    `;
    const group = rows[0] ?? null;

    if (!group) {
      return applyCors(req, jsonOk({ group: null }));
    }
    if (!group.isPublic && !await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, select: { id: true } })) {
      throw new HttpError(403, "Эта группа доступна только участникам");
    }
    const avatarUrl = group.avatarUrl ?? generateDefaultAvatarDataUrl(group.name, group.link);

    return applyCors(
      req,
      jsonOk({
        group: {
          id: group.id,
          link: group.link,
          name: group.name,
          reactionMode: group.reactionMode,
          allowedReactions: group.allowedReactions,
          description: group.description,
          avatarUrl,
          isPublic: group.isPublic,
          membersCount: Number(group.membersCount),
          createdAt: group.createdAt.toISOString(),
        },
      }),
    );
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const payload = communitySettingsSchema.parse(await readJsonBody(req, 4 * 1024 * 1024));
    const group = await updateCommunitySettings("group", user.id, normalizeLink(link), payload);
    const res = jsonOk({ group });
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
    const { link: rawLink } = await params;
    const link = normalizeLink(rawLink);

    const groupRows = await prisma.$queryRaw<
      Array<{
        id: string;
        ownerId: string;
      }>
    >`
      SELECT g."id", g."ownerId"
      FROM "Group" g
      JOIN "GroupMember" gm ON gm."groupId" = g."id"
      WHERE g."link" = ${link} AND gm."userId" = ${user.id}
      LIMIT 1
    `;
    const group = groupRows[0] ?? null;
    if (!group) {
      throw new HttpError(403, "Вы не состоите в этой группе");
    }
    if (group.ownerId !== user.id) {
      throw new HttpError(403, "Удалить группу может только создатель");
    }

    await prisma.$executeRaw`
      DELETE FROM "Group"
      WHERE "id" = ${group.id}
    `;

    const res = jsonOk({ deleted: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
