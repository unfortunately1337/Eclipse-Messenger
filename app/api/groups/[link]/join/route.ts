import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
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

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;
    const link = normalizeLink(rawLink);

    const groupRows = await prisma.$queryRaw<
      Array<{
        id: string;
        link: string;
        name: string;
        avatarUrl: string | null;
        ownerId: string;
        isPublic: boolean;
        createdAt: Date;
      }>
    >`
      SELECT "id", "link", "name", "avatarUrl", "ownerId", "isPublic", "createdAt"
      FROM "Group"
      WHERE "link" = ${link}
      LIMIT 1
    `;
    const group = groupRows[0] ?? null;
    if (!group) {
      throw new HttpError(404, "Группа не найдена");
    }
    if (!group.isPublic && group.ownerId !== user.id) {
      throw new HttpError(403, "Группа приватная");
    }

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      select: { id: true, role: true, roleLabel: true },
    });

    if (!existing) {
      await prisma.groupMember.create({
        data: {
          id: randomUUID(),
          groupId: group.id,
          userId: user.id,
          role: "member",
        },
      });
    }

    try {
      await triggerRealtimeEvent({
        channel: userPrivateChannel(user.id),
        name: "group:added",
        data: {
          id: group.id,
          link: group.link,
          name: group.name,
          avatarUrl: group.avatarUrl,
          createdAt: group.createdAt.toISOString(),
          previewText: "Вы вступили в группу",
        },
      });
    } catch {
      // ignore realtime failures
    }

    try {
      await triggerRealtimeEvent({
        channel: userPrivateChannel(group.ownerId),
        name: "group:e2e-rotate",
        data: { groupLink: group.link, groupId: group.id },
      });
    } catch {
      // ignore realtime failures
    }

    await invalidateChatListPayloadCache(user.id);
    const countRows = await prisma.$queryRaw<Array<{ value: bigint | number }>>`
      SELECT COUNT(*)::bigint AS value
      FROM "GroupMember"
      WHERE "groupId" = ${group.id}
    `;

    const res = jsonOk({
      joined: true,
      membersCount: Number(countRows[0]?.value ?? 1),
      group: {
        id: group.id,
        link: group.link,
        name: group.name,
        avatarUrl: group.avatarUrl,
        isPublic: group.isPublic,
      },
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
