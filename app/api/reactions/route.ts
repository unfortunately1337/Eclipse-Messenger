import { isReactionAllowed } from "@/lib/reaction-policy";
import { readJsonBody } from "@/lib/server/request-body";
import { createReactionSummarySnapshot } from "@/lib/server/reaction-summary";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf, ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";

const bodySchema = z.object({
  chatType: z.enum(["direct", "group", "channel", "saved", "eclipse"]),
  messageId: z.string().min(1).max(128),
  emoji: z.string().min(1).max(16),
});

const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Regional_Indicator}{2}|\u2764\uFE0F|\u2763\uFE0F|[\u{1F300}-\u{1FAFF}])+$/u;

function isReactionsStorageMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
}

function normalizeEmojiForCompare(e: string) {
  return e.replace(/\uFE0F/g, "").trim();
}

async function loadReactionSnapshot(chatType: "direct" | "group" | "channel", messageId: string) {
  const select = { emoji: true, userId: true, user: { select: { avatarUrl: true } } } as const;
  if (chatType === "direct") return prisma.messageReaction.findMany({ where: { messageId }, select });
  if (chatType === "group") return prisma.groupMessageReaction.findMany({ where: { groupMessageId: messageId }, select });
  return prisma.channelPostReaction.findMany({ where: { postId: messageId }, select: { emoji: true, userId: true } });
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const payload = bodySchema.parse(await readJsonBody(req, 128 * 1024));

    if (payload.messageId.startsWith("optimistic:") || payload.messageId.startsWith("msg:")) {
      throw new HttpError(400, "Message is still being sent");
    }

    if (!emojiRegex.test(payload.emoji)) {
      throw new HttpError(400, "Unsupported reaction");
    }

    let targetChatType = payload.chatType;

    // Check direct / saved / eclipse message table first if requested, or as fallback
    let directMessage = null;
    if (targetChatType === "direct" || targetChatType === "saved" || targetChatType === "eclipse") {
      directMessage = await prisma.message.findFirst({
        where: { id: payload.messageId },
        select: {
          id: true,
          conversationId: true,
          conversation: {
            select: { id: true, type: true, ownerUserId: true, isSystem: true },
          },
        },
      });

      if (!directMessage) {
        // Fallback: Check if message exists in group or channel table
        const groupMsg = await prisma.groupMessage.findFirst({
          where: { id: payload.messageId },
          select: { id: true },
        });
        if (groupMsg) {
          targetChatType = "group";
        } else {
          const chPost = await prisma.channelPost.findFirst({
            where: { id: payload.messageId },
            select: { id: true },
          });
          if (chPost) {
            targetChatType = "channel";
          }
        }
      }
    }

    if (targetChatType === "direct" || targetChatType === "saved" || targetChatType === "eclipse") {
      if (!directMessage) {
        throw new HttpError(404, "Message not found");
      }

      // chatType is an untrusted UI hint, never an authorization grant.
      const participant = await prisma.conversationParticipant.findFirst({
        where: { conversationId: directMessage.conversationId, userId: user.id },
        select: { id: true },
      });
      if (!participant) throw new HttpError(403, "Not a participant");

      const existing = await prisma.messageReaction.findMany({
        where: { messageId: directMessage.id, userId: user.id },
        select: { emoji: true },
      });
      const shouldRemove = existing.some(
        (row) => normalizeEmojiForCompare(row.emoji) === normalizeEmojiForCompare(payload.emoji),
      );

      try {
        await prisma.$transaction([
          prisma.messageReaction.deleteMany({
            where: { messageId: directMessage.id, userId: user.id },
          }),
          ...(shouldRemove
            ? []
            : [
                prisma.messageReaction.create({
                  data: { messageId: directMessage.id, userId: user.id, emoji: payload.emoji },
                }),
              ]),
        ]);
      } catch (txErr: unknown) {
        const code = (txErr as { code?: unknown })?.code;
        if (code !== "P2002" && code !== "P2034") {
          throw txErr;
        }
      }

      const targetMessageId = directMessage.id;
      const targetConversationId = directMessage.conversationId;
      const snapshot = createReactionSummarySnapshot(await loadReactionSnapshot("direct", targetMessageId), true);
      const reactions = snapshot(user.id);

      const otherParticipants = await prisma.conversationParticipant.findMany({
        where: { conversationId: targetConversationId, userId: { not: user.id } },
        select: { userId: true },
      });
      void Promise.allSettled(
        otherParticipants.map(async (recipient) => {
          try {
            const recipientReactions = snapshot(recipient.userId);
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "reaction:update",
              data: {
                chatType: targetChatType === "eclipse" ? "eclipse" : "direct",
                messageId: targetMessageId,
                reactions: recipientReactions,
                fromUserId: user.id,
              },
            });
          } catch {
            // ignore realtime failures
          }
        }),
      );

      const res = jsonOk({ messageId: targetMessageId, reactions });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (targetChatType === "group") {
      const groupMessage = await prisma.groupMessage.findFirst({
        where: { id: payload.messageId },
        select: { id: true, groupId: true, group: { select: { link: true, ownerId: true, isPublic: true, reactionMode: true, allowedReactions: true } } },
      });

      if (!groupMessage) {
        // Fallback: check direct message table
        const dm = await prisma.message.findFirst({
          where: { id: payload.messageId },
          select: { id: true, conversationId: true, conversation: { select: { id: true, type: true, ownerUserId: true, isSystem: true } } },
        });
        if (dm) {
          directMessage = dm;
          targetChatType = "direct";
        } else {
          const chPost = await prisma.channelPost.findFirst({
            where: { id: payload.messageId },
            select: { id: true },
          });
          if (chPost) {
            targetChatType = "channel";
          }
        }
      }

      if (targetChatType === "group") {
        if (!groupMessage) throw new HttpError(404, "Message not found");

        const isOwner = groupMessage.group.ownerId === user.id;
        const member = await prisma.groupMember.findFirst({
          where: { groupId: groupMessage.groupId, userId: user.id },
          select: { id: true },
        });
        if (!member && !isOwner && !groupMessage.group.isPublic) {
          throw new HttpError(403, "Not a group member");
        }

        const existing = await prisma.groupMessageReaction.findMany({
          where: { groupMessageId: groupMessage.id, userId: user.id },
          select: { emoji: true },
        });
        const shouldRemove = existing.some(
          (row) => normalizeEmojiForCompare(row.emoji) === normalizeEmojiForCompare(payload.emoji),
        );
        if (!shouldRemove && !isReactionAllowed(groupMessage.group, payload.emoji)) {
          throw new HttpError(403, "Эта реакция недоступна в этом чате");
        }

        try {
          await prisma.$transaction([
            prisma.groupMessageReaction.deleteMany({
              where: { groupMessageId: groupMessage.id, userId: user.id },
            }),
            ...(shouldRemove
              ? []
              : [
                  prisma.groupMessageReaction.create({
                    data: { groupMessageId: groupMessage.id, userId: user.id, emoji: payload.emoji },
                  }),
                ]),
          ]);
        } catch (txErr: unknown) {
          const code = (txErr as { code?: unknown })?.code;
          if (code !== "P2002" && code !== "P2034") {
            throw txErr;
          }
        }

        const snapshot = createReactionSummarySnapshot(await loadReactionSnapshot("group", groupMessage.id), true);
      const reactions = snapshot(user.id);
        const members = await prisma.groupMember.findMany({
          where: { groupId: groupMessage.groupId, userId: { not: user.id } },
          select: { userId: true },
        });
        void Promise.allSettled(
          members.map(async (recipient) => {
            try {
              const recipientReactions = snapshot(recipient.userId);
              await triggerRealtimeEvent({
                channel: userPrivateChannel(recipient.userId),
                name: "reaction:update",
                data: {
                  chatType: "group",
                  messageId: groupMessage.id,
                  groupLink: groupMessage.group.link,
                  reactions: recipientReactions,
                  fromUserId: user.id,
                },
              });
            } catch {
              // ignore realtime failures
            }
          }),
        );

        const res = jsonOk({ messageId: groupMessage.id, reactions });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
    }

    const channelMessage = await prisma.channelPost.findFirst({
      where: { id: payload.messageId },
      select: { id: true, channelId: true, channel: { select: { link: true, ownerId: true, isPublic: true, reactionMode: true, allowedReactions: true } } },
    });
    if (!channelMessage) throw new HttpError(404, "Post not found");

    // Public posts allow readers; private posts require channel membership.
    const isSubscriber = await prisma.channelSubscriber.findFirst({
      where: { channelId: channelMessage.channelId, userId: user.id },
      select: { id: true },
    });
    if (!channelMessage.channel.isPublic && channelMessage.channel.ownerId !== user.id && !isSubscriber) {
      throw new HttpError(403, "Not a subscriber");
    }

    const existing = await prisma.channelPostReaction.findMany({
      where: { postId: channelMessage.id, userId: user.id },
      select: { emoji: true },
    });
    const shouldRemove = existing.some(
      (row) => normalizeEmojiForCompare(row.emoji) === normalizeEmojiForCompare(payload.emoji),
    );
    if (!shouldRemove && !isReactionAllowed(channelMessage.channel, payload.emoji)) {
      throw new HttpError(403, "Эта реакция недоступна в этом чате");
    }

    try {
      await prisma.$transaction([
        prisma.channelPostReaction.deleteMany({
          where: { postId: channelMessage.id, userId: user.id },
        }),
        ...(shouldRemove
          ? []
          : [
              prisma.channelPostReaction.create({
                data: { postId: channelMessage.id, userId: user.id, emoji: payload.emoji },
              }),
            ]),
      ]);
    } catch (txErr: unknown) {
      const code = (txErr as { code?: unknown })?.code;
      if (code !== "P2002" && code !== "P2034") {
        throw txErr;
      }
    }

    const snapshot = createReactionSummarySnapshot(await loadReactionSnapshot("channel", channelMessage.id), false);
      const reactions = snapshot(user.id);
    const recipients = await prisma.channelSubscriber.findMany({
      where: { channelId: channelMessage.channelId, userId: { not: user.id } },
      select: { userId: true },
    });
    const recipientIds = new Set(recipients.map((row) => row.userId));
    if (channelMessage.channel.ownerId !== user.id) {
      recipientIds.add(channelMessage.channel.ownerId);
    }
    void Promise.allSettled(
      Array.from(recipientIds).map(async (recipientId) => {
        try {
          const recipientReactions = snapshot(recipientId);
          await triggerRealtimeEvent({
            channel: userPrivateChannel(recipientId),
            name: "reaction:update",
            data: {
              chatType: "channel",
              messageId: channelMessage.id,
              groupLink: channelMessage.channel.link,
              reactions: recipientReactions,
              fromUserId: user.id,
            },
          });
        } catch {
          // ignore realtime failures
        }
      }),
    );

    const res = jsonOk({ messageId: channelMessage.id, reactions });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    if (isReactionsStorageMissing(error)) {
      return applyCors(req, jsonError(new HttpError(503, "Reactions storage is not initialized. Apply DB migrations.")));
    }
    return applyCors(req, jsonError(error));
  }
}
