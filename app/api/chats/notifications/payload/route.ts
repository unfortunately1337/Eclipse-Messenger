import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/server/auth";
import { jsonOk, applyCors } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { getGroupReadMarkers, getChannelReadMarkers } from "@/lib/server/chat-read-state";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId")?.trim();

    if (!auth?.user || !messageId) {
      return applyCors(req, jsonOk({ alreadyRead: false }));
    }

    const userId = auth.user.id;

    // 1. Check direct message
    const directMessage = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        createdAt: true,
        conversationId: true,
        cipherText: true,
        iv: true,
        encryptedKeyForSender: true,
        encryptedKeyForRecipient: true,
        senderId: true,
      },
    });

    if (directMessage) {
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: directMessage.conversationId,
          userId,
        },
        select: { lastReadAt: true },
      });

      if (participant) {
        const lastRead = participant.lastReadAt ? participant.lastReadAt.getTime() : 0;
        const msgTime = directMessage.createdAt.getTime();
        const recentlyActive = Date.now() - lastRead < 15000;

        if (lastRead >= msgTime || recentlyActive) {
          return applyCors(req, jsonOk({ alreadyRead: true }));
        }

        const isSender = directMessage.senderId === userId;
        return applyCors(
          req,
          jsonOk({
            alreadyRead: false,
            cipherText: directMessage.cipherText,
            iv: directMessage.iv,
            encryptedKey: isSender
              ? directMessage.encryptedKeyForSender
              : directMessage.encryptedKeyForRecipient,
          }),
        );
      }
    }

    // 2. Check group message
    const groupMessage = await prisma.groupMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        groupId: true,
        createdAt: true,
        cipherText: true,
        iv: true,
        keyVersion: true,
      },
    });

    if (groupMessage) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: groupMessage.groupId, userId } },
        select: { id: true },
      });
      if (!member) return applyCors(req, jsonOk({ alreadyRead: false }));
      const readMap = await getGroupReadMarkers(userId, [groupMessage.groupId]).catch(() => new Map());
      const lastReadDate = readMap.get(groupMessage.groupId);
      const lastRead = lastReadDate ? lastReadDate.getTime() : 0;
      const msgTime = groupMessage.createdAt.getTime();
      const recentlyActive = Date.now() - lastRead < 15000;

      if (lastRead >= msgTime || recentlyActive) {
        return applyCors(req, jsonOk({ alreadyRead: true }));
      }

      return applyCors(
        req,
        jsonOk({
          alreadyRead: false,
          cipherText: groupMessage.cipherText,
          iv: groupMessage.iv,
          keyVersion: groupMessage.keyVersion,
        }),
      );
    }

    // 3. Check channel post
    const channelPost = await prisma.channelPost.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        channelId: true,
        createdAt: true,
        cipherText: true,
        iv: true,
        keyVersion: true,
      },
    });

    if (channelPost) {
      const channel = await prisma.channel.findFirst({
        where: {
          id: channelPost.channelId,
          OR: [{ ownerId: userId }, { subscribers: { some: { userId } } }],
        },
        select: { id: true },
      });
      if (!channel) return applyCors(req, jsonOk({ alreadyRead: false }));
      const readMap = await getChannelReadMarkers(userId, [channelPost.channelId]).catch(() => new Map());
      const lastReadDate = readMap.get(channelPost.channelId);
      const lastRead = lastReadDate ? lastReadDate.getTime() : 0;
      const msgTime = channelPost.createdAt.getTime();
      const recentlyActive = Date.now() - lastRead < 15000;

      if (lastRead >= msgTime || recentlyActive) {
        return applyCors(req, jsonOk({ alreadyRead: true }));
      }

      return applyCors(
        req,
        jsonOk({
          alreadyRead: false,
          cipherText: channelPost.cipherText,
          iv: channelPost.iv,
          keyVersion: channelPost.keyVersion,
        }),
      );
    }

    return applyCors(req, jsonOk({ alreadyRead: false }));
  } catch {
    return applyCors(req, jsonOk({ alreadyRead: false }));
  }
}
