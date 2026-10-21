import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf, ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";

const voteSchema = z.object({
  messageId: z.string().min(1),
  optionIdx: z.number().int().nonnegative(),
});

async function verifyAccessAndGetChatDetails(messageId: string, userId: string) {
  // 1. Check direct message
  const directMsg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true },
  });
  if (directMsg) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: directMsg.conversationId, userId },
    });
    if (!participant) throw new HttpError(403, "Forbidden");

    const otherParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId: directMsg.conversationId, userId: { not: userId } },
      select: { userId: true },
    });

    return {
      chatType: "direct" as const,
      groupLink: null,
      recipients: otherParticipants.map(p => p.userId),
    };
  }

  // 2. Check group message
  const groupMsg = await prisma.groupMessage.findUnique({
    where: { id: messageId },
    select: { id: true, groupId: true, group: { select: { link: true } } },
  });
  if (groupMsg) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: groupMsg.groupId, userId },
    });
    if (!member) throw new HttpError(403, "Forbidden");

    const otherMembers = await prisma.groupMember.findMany({
      where: { groupId: groupMsg.groupId, userId: { not: userId } },
      select: { userId: true },
    });

    return {
      chatType: "group" as const,
      groupLink: groupMsg.group.link,
      recipients: otherMembers.map(m => m.userId),
    };
  }

  // 3. Check channel post
  const channelMsg = await prisma.channelPost.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, channel: { select: { link: true, ownerId: true } } },
  });
  if (channelMsg) {
    const subscriber = await prisma.channelSubscriber.findFirst({
      where: { channelId: channelMsg.channelId, userId },
    });
    if (!subscriber && channelMsg.channel.ownerId !== userId) {
      throw new HttpError(403, "Forbidden");
    }

    const otherSubscribers = await prisma.channelSubscriber.findMany({
      where: { channelId: channelMsg.channelId, userId: { not: userId } },
      select: { userId: true },
    });
    const recipients = otherSubscribers.map(s => s.userId);
    if (channelMsg.channel.ownerId !== userId) {
      recipients.push(channelMsg.channel.ownerId);
    }

    return {
      chatType: "channel" as const,
      groupLink: channelMsg.channel.link,
      recipients,
    };
  }

  throw new HttpError(404, "Message not found");
}

async function buildPollResults(messageId: string, currentUserId: string) {
  const votes = await prisma.pollVote.findMany({
    where: { messageId },
    select: { userId: true, optionIdx: true },
  });

  const totalVotes = votes.length;
  const optionCounts: Record<number, number> = {};
  let userVotedOptionIdx: number | null = null;

  votes.forEach((v) => {
    optionCounts[v.optionIdx] = (optionCounts[v.optionIdx] || 0) + 1;
    if (v.userId === currentUserId) {
      userVotedOptionIdx = v.optionIdx;
    }
  });

  return {
    messageId,
    totalVotes,
    optionCounts,
    userVotedOptionIdx,
  };
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const messageId = req.nextUrl.searchParams.get("messageId");
    if (!messageId) {
      throw new HttpError(400, "Missing messageId");
    }

    await verifyAccessAndGetChatDetails(messageId, user.id);
    const results = await buildPollResults(messageId, user.id);

    const res = jsonOk(results);
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const payload = voteSchema.parse(await readJsonBody(req, 128 * 1024));

    const chatDetails = await verifyAccessAndGetChatDetails(payload.messageId, user.id);

    const existingVote = await prisma.pollVote.findUnique({
      where: {
        messageId_userId: {
          messageId: payload.messageId,
          userId: user.id,
        },
      },
    });

    if (existingVote && existingVote.optionIdx === payload.optionIdx) {
      await prisma.pollVote.delete({
        where: {
          messageId_userId: {
            messageId: payload.messageId,
            userId: user.id,
          },
        },
      });
    } else {
      await prisma.pollVote.upsert({
        where: {
          messageId_userId: {
            messageId: payload.messageId,
            userId: user.id,
          },
        },
        create: {
          messageId: payload.messageId,
          userId: user.id,
          optionIdx: payload.optionIdx,
        },
        update: {
          optionIdx: payload.optionIdx,
        },
      });
    }

    const results = await buildPollResults(payload.messageId, user.id);

    // Broadcast realtime event to other participants
    void Promise.allSettled(
      chatDetails.recipients.map(async (recipientId) => {
        try {
          const recipientResults = await buildPollResults(payload.messageId, recipientId);
          await triggerRealtimeEvent({
            channel: userPrivateChannel(recipientId),
            name: "poll:update",
            data: {
              ...recipientResults,
              chatType: chatDetails.chatType,
              groupLink: chatDetails.groupLink,
            },
          });
        } catch {
          // ignore realtime failures
        }
      })
    );

    const res = jsonOk(results);
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
