import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { revokeChannelSharedKeysForMember } from "@/lib/server/e2e-shared-member";
import { normalizeLink } from "@/lib/server/validation";

type Params = {
  params: Promise<{ link: string }>;
};

async function resolveChannel(link: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; ownerId: string; isPublic: boolean }>>`
    SELECT "id", "ownerId", "isPublic"
    FROM "Channel"
    WHERE "link" = ${link}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;
    const link = normalizeLink(rawLink);

    const channel = await resolveChannel(link);
    if (!channel) {
      throw new HttpError(404, "Канал не найден");
    }
    if (!channel.isPublic && channel.ownerId !== user.id) {
      throw new HttpError(403, "Канал приватный");
    }

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ChannelSubscriber" ("id", "channelId", "userId", "createdAt")
      VALUES (${id}, ${channel.id}, ${user.id}, NOW())
      ON CONFLICT ("channelId", "userId") DO NOTHING
    `;

    const countRows = await prisma.$queryRaw<Array<{ value: bigint | number }>>`
      SELECT COUNT(*)::bigint AS value
      FROM "ChannelSubscriber"
      WHERE "channelId" = ${channel.id}
    `;

    const res = jsonOk({
      subscribed: true,
      subscribersCount: String(Number(countRows[0]?.value ?? 0)),
    });
    ensureCsrfCookie(req, res);
    try {
      await triggerRealtimeEvent({
        channel: userPrivateChannel(channel.ownerId),
        name: "channel:e2e-rotate",
        data: { channelLink: link, channelId: channel.id },
      });
    } catch {
      // ignore realtime failures
    }
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

    const channel = await resolveChannel(link);
    if (!channel) {
      throw new HttpError(404, "Канал не найден");
    }
    if (channel.ownerId === user.id) {
      throw new HttpError(400, "Создатель не может покинуть канал");
    }

    await prisma.$executeRaw`
      DELETE FROM "ChannelSubscriber"
      WHERE "channelId" = ${channel.id} AND "userId" = ${user.id}
    `;
    await revokeChannelSharedKeysForMember(channel.id, user.id);

    const countRows = await prisma.$queryRaw<Array<{ value: bigint | number }>>`
      SELECT COUNT(*)::bigint AS value
      FROM "ChannelSubscriber"
      WHERE "channelId" = ${channel.id}
    `;

    const res = jsonOk({
      subscribed: false,
      subscribersCount: String(Number(countRows[0]?.value ?? 0)),
    });
    ensureCsrfCookie(req, res);
    try {
      await triggerRealtimeEvent({
        channel: userPrivateChannel(channel.ownerId),
        name: "channel:e2e-rotate",
        data: { channelLink: link, channelId: channel.id, rotate: true },
      });
    } catch {
      // ignore realtime failures
    }
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
