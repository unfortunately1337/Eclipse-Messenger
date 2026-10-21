import { readRequestBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { canViewerSeeTypingStatus, getPrivacyDisplayName, getPrivacySettings } from "@/lib/server/privacy-settings";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { grantInteractionPresence } from "@/lib/server/presence";
import { normalizeLink } from "@/lib/server/validation";
import { SAVED_DIALOG_LINK } from "@/lib/server/chat";

const bodySchema = z.object({
  link: z.string().min(1),
  chatType: z.enum(["direct", "group", "saved"]).optional(),
  isTyping: z.boolean(),
});

const MAX_REALTIME_FANOUT = 120;

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const rawBody = new TextDecoder().decode(await readRequestBody(req, 128 * 1024));
    if (!rawBody.trim()) {
      const res = jsonOk({ ok: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Некорректное тело запроса");
    }
    const body = bodySchema.parse(parsedBody);
    if (body.chatType === "saved" || body.link === SAVED_DIALOG_LINK) {
      const res = jsonOk({ ok: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    if (body.link.startsWith("secret-")) {
      const secretChatId = body.link.substring("secret-".length);
      const participants = await prisma.secretChatParticipant.findMany({
        where: { secretChatId },
        select: {
          userId: true,
          user: {
            select: { id: true, link: true, displayName: true },
          },
        },
      });

      const me = participants.find((p) => p.userId === user.id);
      if (!me) {
        throw new HttpError(404, "Чат не найден");
      }

      const peerPart = participants.find((p) => p.userId !== user.id);
      if (peerPart) {
        const peerId = peerPart.userId;
        const privacy = await getPrivacySettings(user.id);
        if (!canViewerSeeTypingStatus(peerId, user.id, privacy)) {
          const res = jsonOk({ ok: true });
          ensureCsrfCookie(req, res);
          return applyCors(req, res);
        }

        try {
          if (body.isTyping) await grantInteractionPresence(user.id, [peerId]);
          await triggerRealtimeEvent({
            channel: userPrivateChannel(peerId),
            name: "typing:update",
            data: {
              chatType: "direct",
              fromUserId: user.id,
              fromLink: body.link,
              fromDisplayName: getPrivacyDisplayName(peerId, user.id, user.displayName, privacy),
              isTyping: body.isTyping,
              at: new Date().toISOString(),
            },
          });
        } catch {
          // ignore realtime errors
        }
      }

      const res = jsonOk({ ok: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const link = normalizeLink(body.link);
    const preferredChatType = body.chatType ?? null;
    const privacy = await getPrivacySettings(user.id);

    const peer =
      preferredChatType === "group"
        ? null
        : await prisma.user.findUnique({
            where: { link },
            select: { id: true, link: true },
          });

    if (peer) {
      if (peer.id === user.id) {
        throw new HttpError(400, "Нельзя отправлять typing себе");
      }
      if (!canViewerSeeTypingStatus(peer.id, user.id, privacy)) {
        const res = jsonOk({ ok: true });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      try {
        if (body.isTyping) await grantInteractionPresence(user.id, [peer.id]);
        await triggerRealtimeEvent({
          channel: userPrivateChannel(peer.id),
          name: "typing:update",
          data: {
            chatType: "direct",
            fromUserId: user.id,
            fromLink: user.link,
            fromDisplayName: getPrivacyDisplayName(peer.id, user.id, user.displayName, privacy),
            isTyping: body.isTyping,
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

    const groupRows = await prisma.$queryRaw<Array<{ id: string; link: string }>>`
      SELECT g."id", g."link"
      FROM "Group" g
      JOIN "GroupMember" me ON me."groupId" = g."id"
      WHERE g."link" = ${link} AND me."userId" = ${user.id}
      LIMIT 1
    `;
    const group = groupRows[0] ?? null;

    if (!group) {
      throw new HttpError(404, "Чат не найден");
    }

    const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "GroupMember"
      WHERE "groupId" = ${group.id}
        AND "userId" <> ${user.id}
    `;

    const visibleRecipients = recipients.slice(0, MAX_REALTIME_FANOUT)
      .filter(recipient => canViewerSeeTypingStatus(recipient.userId, user.id, privacy));
    if (body.isTyping) await grantInteractionPresence(user.id, visibleRecipients.map(recipient => recipient.userId));
    await Promise.allSettled(
      visibleRecipients
        .map(async (recipient) => {
          const fromDisplayName = getPrivacyDisplayName(recipient.userId, user.id, user.displayName, privacy);
          try {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "typing:update",
              data: {
                chatType: "group",
                fromUserId: user.id,
                fromLink: user.link,
                fromDisplayName,
                groupLink: group.link,
                isTyping: body.isTyping,
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
