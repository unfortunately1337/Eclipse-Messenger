import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { findDirectConversation } from "@/lib/server/chat";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { setChannelReadMarker, setGroupReadMarker } from "@/lib/server/chat-read-state";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { grantInteractionPresence } from "@/lib/server/presence";
import { normalizeLink } from "@/lib/server/validation";
import { ECLIPSE_DIALOG_LINK, getOrCreateEclipseDialog, SAVED_DIALOG_LINK } from "@/lib/server/chat";
import { getPrivacyDisplayName, getPrivacySettings } from "@/lib/server/privacy-settings";

const bodySchema = z.object({
  link: z.string().min(1),
  chatType: z.enum(["direct", "group", "channel", "saved", "eclipse"]).optional(),
  messageIds: z.array(z.string().min(1).max(128)).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const body = bodySchema.parse(await readJsonBody(req, 128 * 1024));
    const privacy = await getPrivacySettings(user.id);
    if (!privacy.showReadReceipts) {
      const res = jsonOk({ ok: true, count: 0, hidden: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    if (body.chatType === "saved" || body.link === SAVED_DIALOG_LINK) {
      const res = jsonOk({ ok: true, count: 0 });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    if (body.chatType === "eclipse" || body.link === ECLIPSE_DIALOG_LINK) {
      const conversationId = await getOrCreateEclipseDialog(user.id);
      const validMessages = await prisma.message.findMany({
        where: {
          id: { in: body.messageIds },
          conversationId,
        },
        select: { id: true, createdAt: true },
      });
      const validMessageIds = validMessages.map((message) => message.id);
      const latestReadAt =
        validMessages.length > 0
          ? new Date(Math.max(...validMessages.map((message) => message.createdAt.getTime())))
          : null;

      if (latestReadAt) {
        await prisma.$executeRaw`
          UPDATE "ConversationParticipant"
          SET "lastReadAt" = ${latestReadAt}
          WHERE "conversationId" = ${conversationId}
            AND "userId" = ${user.id}
            AND ("lastReadAt" IS NULL OR "lastReadAt" < ${latestReadAt})
        `;
        await invalidateChatListPayloadCache(user.id);
      }

      const res = jsonOk({ ok: true, count: validMessageIds.length });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    const link = normalizeLink(body.link);
    if (body.chatType === "group") {
      const group = await prisma.group.findFirst({
        where: {
          link,
          members: {
            some: { userId: user.id },
          },
        },
        select: { id: true },
      });
      if (!group) {
        throw new HttpError(404, "Чат не найден");
      }

      const validMessages = await prisma.groupMessage.findMany({
        where: {
          id: { in: body.messageIds },
          groupId: group.id,
          senderId: { not: user.id },
        },
        select: { id: true, senderId: true, createdAt: true },
      });
      const validMessageIds = validMessages.map((message) => message.id);
      if (privacy.autoDeleteReadMessages && validMessageIds.length > 0) {
        await prisma.hiddenChatMessage.createMany({
          data: validMessageIds.map((messageId) => ({ userId: user.id, chatType: "group", messageId })),
          skipDuplicates: true,
        });
      }
      const latestReadAt =
        validMessages.length > 0
          ? new Date(Math.max(...validMessages.map((message) => message.createdAt.getTime())))
          : null;

      if (latestReadAt) {
        await setGroupReadMarker(user.id, group.id, latestReadAt);
        await invalidateChatListPayloadCache(user.id);
      }

      if (validMessageIds.length > 0) {
        const messagesBySender = new Map<string, string[]>();
        for (const message of validMessages) {
          const ids = messagesBySender.get(message.senderId) ?? [];
          ids.push(message.id);
          messagesBySender.set(message.senderId, ids);
        }
        await Promise.allSettled(
          Array.from(messagesBySender.entries()).map(async ([senderId, messageIds]) => {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(senderId),
              name: "message:read",
              data: {
                chatType: "group",
                fromUserId: user.id,
                fromLink: user.link,
                fromDisplayName: getPrivacyDisplayName(senderId, user.id, user.displayName, privacy),
                fromAvatarUrl: user.avatarUrl ?? null,
                groupLink: link,
                messageIds,
                at: (latestReadAt ?? new Date()).toISOString(),
              },
            });
          }),
        );
      }

      const res = jsonOk({ ok: true, count: validMessageIds.length });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (body.chatType === "channel") {
      const channel = await prisma.channel.findFirst({
        where: {
          link,
          OR: [
            { ownerId: user.id },
            {
              subscribers: {
                some: { userId: user.id },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!channel) {
        throw new HttpError(404, "Чат не найден");
      }

      const validMessages = await prisma.channelPost.findMany({
        where: {
          id: { in: body.messageIds },
          channelId: channel.id,
          authorId: { not: user.id },
        },
        select: { id: true, createdAt: true },
      });
      const validMessageIds = validMessages.map((message) => message.id);
      if (privacy.autoDeleteReadMessages && validMessageIds.length > 0) {
        await prisma.hiddenChatMessage.createMany({
          data: validMessageIds.map((messageId) => ({ userId: user.id, chatType: "channel", messageId })),
          skipDuplicates: true,
        });
      }
      const latestReadAt =
        validMessages.length > 0
          ? new Date(Math.max(...validMessages.map((message) => message.createdAt.getTime())))
          : null;

      if (latestReadAt) {
        await setChannelReadMarker(user.id, channel.id, latestReadAt);
        await invalidateChatListPayloadCache(user.id);
      }

      const res = jsonOk({ ok: true, count: validMessageIds.length });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const peer = await prisma.user.findUnique({
      where: { link },
      select: { id: true, link: true },
    });

    if (!peer) {
      throw new HttpError(404, "Чат не найден");
    }
    if (peer.id === user.id) {
      throw new HttpError(400, "Нельзя отправлять read receipt себе");
    }

    const conversationId = await findDirectConversation(user.id, peer.id);
    if (!conversationId) {
      const res = jsonOk({ ok: true, count: 0 });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    const validMessages = await prisma.message.findMany({
      where: {
        id: { in: body.messageIds },
        conversationId,
        senderId: peer.id,
      },
      select: { id: true, createdAt: true },
    });
    const validMessageIds = validMessages.map((message) => message.id);
    if (privacy.autoDeleteReadMessages && validMessageIds.length > 0) {
      await prisma.hiddenChatMessage.createMany({
        data: validMessageIds.map((messageId) => ({ userId: user.id, chatType: "direct", messageId })),
        skipDuplicates: true,
      });
    }
    const latestReadAt =
      validMessages.length > 0
        ? new Date(Math.max(...validMessages.map((message) => message.createdAt.getTime())))
        : null;

    let advancedReadMarker = false;
    if (latestReadAt) {
      const updated = await prisma.$executeRaw`
        UPDATE "ConversationParticipant"
        SET "lastReadAt" = ${latestReadAt}
        WHERE "conversationId" = ${conversationId}
          AND "userId" = ${user.id}
          AND ("lastReadAt" IS NULL OR "lastReadAt" < ${latestReadAt})
      `;
      advancedReadMarker = updated > 0;
    }

    if (validMessageIds.length > 0) {
      if (advancedReadMarker) await grantInteractionPresence(user.id, [peer.id]);
      try {
        await triggerRealtimeEvent({
          channel: userPrivateChannel(peer.id),
          name: "message:read",
          data: {
            chatType: "direct",
            fromUserId: user.id,
            fromLink: user.link,
            messageIds: validMessageIds,
            at: (latestReadAt ?? new Date()).toISOString(),
          },
        });
      } catch {
        // realtime transport failures should not break chat UX
      }
    }

    const res = jsonOk({ ok: true, count: validMessageIds.length });
    if (latestReadAt) {
      await invalidateChatListPayloadCache(user.id);
    }
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
