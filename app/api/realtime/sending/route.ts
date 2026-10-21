import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { canViewerSeeMediaActivityStatus, getPrivacyDisplayName, getPrivacySettings } from "@/lib/server/privacy-settings";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { normalizeLink } from "@/lib/server/validation";
import { SAVED_DIALOG_LINK } from "@/lib/server/chat";

const bodySchema = z.object({
  link: z.string().min(1),
  chatType: z.enum(["direct", "group", "channel", "saved"]).optional(),
  kind: z.enum(["image", "video", "music", "file", "voice", "video_note"]),
  isSending: z.boolean(),
});

const MAX_REALTIME_FANOUT = 120;

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const body = bodySchema.parse(await readJsonBody(req, 128 * 1024));
    if (body.chatType === "saved" || body.link === SAVED_DIALOG_LINK) {
      const res = jsonOk({ ok: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    const link = normalizeLink(body.link);
    const preferredChatType = body.chatType ?? null;
    const privacy = await getPrivacySettings(user.id);

    const peer =
      preferredChatType === "group" || preferredChatType === "channel"
        ? null
        : await prisma.user.findUnique({
            where: { link },
            select: { id: true, link: true },
          });

    if (peer) {
      if (peer.id === user.id) {
        throw new HttpError(400, "Нельзя отправлять sending себе");
      }
      if (!canViewerSeeMediaActivityStatus(peer.id, user.id, privacy)) {
        const res = jsonOk({ ok: true });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      try {
        await triggerRealtimeEvent({
          channel: userPrivateChannel(peer.id),
          name: "sending:update",
          data: {
            chatType: "direct",
            fromUserId: user.id,
            fromLink: user.link,
            fromDisplayName: getPrivacyDisplayName(peer.id, user.id, user.displayName, privacy),
            kind: body.kind,
            isSending: body.isSending,
            at: new Date().toISOString(),
          },
        });
      } catch {
        // realtime transport failures should not break chat UX
      }

      const res = jsonOk({ ok: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const groupRows =
      preferredChatType === "channel"
        ? []
        : await prisma.$queryRaw<Array<{ id: string; link: string }>>`
      SELECT g."id", g."link"
      FROM "Group" g
      JOIN "GroupMember" me ON me."groupId" = g."id"
      WHERE g."link" = ${link} AND me."userId" = ${user.id}
      LIMIT 1
    `;
    const group = groupRows[0] ?? null;

    if (group) {
      const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "GroupMember"
        WHERE "groupId" = ${group.id}
          AND "userId" <> ${user.id}
      `;

      await Promise.allSettled(
        recipients
          .slice(0, MAX_REALTIME_FANOUT)
          .filter((recipient) => canViewerSeeMediaActivityStatus(recipient.userId, user.id, privacy))
          .map(async (recipient) => {
            const fromDisplayName = getPrivacyDisplayName(recipient.userId, user.id, user.displayName, privacy);
            try {
              await triggerRealtimeEvent({
                channel: userPrivateChannel(recipient.userId),
                name: "sending:update",
                data: {
                  chatType: "group",
                  fromUserId: user.id,
                  fromLink: user.link,
                  fromDisplayName,
                  groupLink: group.link,
                  kind: body.kind,
                  isSending: body.isSending,
                  at: new Date().toISOString(),
                },
              });
            } catch {
              // realtime transport failures should not break chat UX
            }
          }),
      );

      const res = jsonOk({ ok: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const channelRows = await prisma.$queryRaw<Array<{ id: string; link: string; ownerId: string }>>`
      SELECT c."id", c."link", c."ownerId"
      FROM "Channel" c
      WHERE c."link" = ${link}
      LIMIT 1
    `;
    const channel = channelRows[0] ?? null;
    if (!channel) {
      throw new HttpError(404, "Чат не найден");
    }
    if (channel.ownerId !== user.id) {
      throw new HttpError(403, "Только владелец канала может отправлять sending");
    }

    const subscribers = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "ChannelSubscriber"
      WHERE "channelId" = ${channel.id}
        AND "userId" <> ${user.id}
    `;

    await Promise.allSettled(
      subscribers
        .slice(0, MAX_REALTIME_FANOUT)
        .filter((recipient) => canViewerSeeMediaActivityStatus(recipient.userId, user.id, privacy))
        .map(async (recipient) => {
          const fromDisplayName = getPrivacyDisplayName(recipient.userId, user.id, user.displayName, privacy);
          try {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "sending:update",
              data: {
                chatType: "channel",
                fromUserId: user.id,
                fromLink: user.link,
                fromDisplayName,
                groupLink: channel.link,
                kind: body.kind,
                isSending: body.isSending,
                at: new Date().toISOString(),
              },
            });
          } catch {
            // realtime transport failures should not break chat UX
          }
        }),
    );

    const res = jsonOk({ ok: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
