import { createHash } from "node:crypto";
import { ACTIVE_SECRET_CHAT_NOTICE } from "@/lib/secret-chat-state";
import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { canUserStartConversation, getPrivacySettings } from "@/lib/server/privacy-settings";
import { secretDeviceKeySchema } from "@/lib/server/secret-device-keys";

const createSecretChatSchema = secretDeviceKeySchema.extend({
  participantUserIds: z.array(z.string().min(1).max(128)).min(1).max(2),
  lifetimeSeconds: z.number().int().min(1).max(31 * 86400).optional(),
  codeword: z.string().trim().max(100).optional().nullable(),
});

function activePairWhere(userIds: string[]) {
  return {
    AND: userIds.map(userId => ({ participants: { some: { userId } } })),
    participants: { every: { userId: { in: userIds } } },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `rate:secret:create:${user.id}`, limit: 10, windowSeconds: 60, message: "Слишком много запросов на создание чата" });
    const body = createSecretChatSchema.parse(await readJsonBody(req, 128 * 1024));

    const lifetimeSeconds = body.lifetimeSeconds ?? 3600;
    const codeword = body.codeword ? body.codeword.trim() : null;

    // De-duplicate user IDs and ensure creator is included
    const allUserIds = Array.from(new Set([user.id, ...body.participantUserIds]));
    if (allUserIds.length !== 2) {
      throw new HttpError(400, "Секретный чат должен содержать ровно двух участников");
    }

    // Validate that all participants exist
    const usersCount = await prisma.user.count({
      where: {
        id: { in: allUserIds },
      },
    });

    if (usersCount !== allUserIds.length) {
      throw new HttpError(400, "Один или несколько участников не найдены");
    }
    if (await prisma.user.count({ where: { id: { in: allUserIds }, isBot: true } })) {
      throw new HttpError(400, "С ботом нельзя начать секретный чат.");
    }
    const recipientId = allUserIds.find((id) => id !== user.id)!;
    const recipientPrivacy = await getPrivacySettings(recipientId);
    if (!canUserStartConversation(user.id, recipientId, recipientPrivacy)) {
      throw new HttpError(403, "Пользователь ограничил новые сообщения");
    }

    // Create chat in database transaction
    const secretChat = await prisma.$transaction(async (tx) => {
      // Serialize creation for the same pair, including simultaneous requests from two tabs.
      const pair = [...allUserIds].sort().join(":");
      const lockKey = BigInt("0x" + createHash("sha256").update("secret-pair:" + pair).digest("hex").slice(0, 15));
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
      if (await tx.secretChat.findFirst({ where: activePairWhere(allUserIds), select: { id: true } })) {
        throw new HttpError(409, ACTIVE_SECRET_CHAT_NOTICE);
      }
      return await tx.secretChat.create({
        data: {
          title: "Секретный чат",
          expiresAt: null, // Initially null, starts counting down on approval
          lifetimeSeconds,
          cryptoVersion: 2,
          codeword,
          participants: {
            create: allUserIds.map((uid) => ({
              userId: uid,
              acceptedSessionId: uid === user.id ? sessionId : null, // Creator's session is accepted immediately
              deviceKeyId: uid === user.id ? body.deviceKeyId : null,
              devicePublicKey: uid === user.id ? body.devicePublicKey : null,
            })),
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                  link: true,
                },
              },
            },
          },
        },
      });
    });

    const peerPart = secretChat.participants.find((p) => p.userId !== user.id) || secretChat.participants[0];
    const contact = peerPart
      ? await prisma.contact.findUnique({
          where: {
            ownerId_peerId: {
              ownerId: user.id,
              peerId: peerPart.userId,
            },
          },
          select: { alias: true },
        })
      : null;

    const targetParticipants = secretChat.participants.filter((p) => p.userId !== user.id);
    await Promise.all(
      targetParticipants.map(async (targetPart) => {
        try {
          await triggerRealtimeEvent({
            channel: userPrivateChannel(targetPart.userId),
            name: "secret:created",
            data: {
              id: secretChat.id,
              title: secretChat.title,
              expiresAt: null,
              lifetimeSeconds: secretChat.lifetimeSeconds,
              isApproved: secretChat.isApproved,
              peer: {
                id: user.id,
                link: user.link,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl ?? null,
              },
            },
          });
        } catch (e) {
          console.error("Failed to trigger secret:created event for", targetPart.userId, e);
        }
      })
    );

    const res = jsonOk({
      success: true,
      chat: {
        id: secretChat.id,
        title: secretChat.title,
        expiresAt: null,
        lifetimeSeconds: secretChat.lifetimeSeconds,
        participants: secretChat.participants.map((p) => {
          if (p.userId === peerPart?.userId && contact?.alias) {
            return {
              ...p.user,
              displayName: contact.alias,
            };
          }
          return p.user;
        }),
      },
    });

    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);

    const peerId = req.nextUrl.searchParams.get("peerId");
    if (peerId !== null) {
      if (!peerId.trim() || peerId.length > 128 || peerId === user.id) throw new HttpError(400, "Некорректный пользователь");
      const existing = await prisma.secretChat.findFirst({ where: activePairWhere([user.id, peerId]), select: { id: true } });
      const res = jsonOk({ exists: Boolean(existing) });
      res.headers.set("Cache-Control", "private, no-store");
      return applyCors(req, res);
    }

    const secretChats = await prisma.secretChat.findMany({
      where: {
        participants: {
          some: { userId: user.id },
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                link: true,
              },
            },
          },
        },
      },
    });

    const activeSecretChats = secretChats.filter((chat) => {
      const myPart = chat.participants.find((p) => p.userId === user.id);
      return Boolean(myPart && (!myPart.acceptedSessionId || myPart.acceptedSessionId === sessionId));
    });

    const contacts = await prisma.contact.findMany({
      where: { ownerId: user.id },
      select: { peerId: true, alias: true },
    });
    const contactMap = new Map(contacts.map((c) => [c.peerId, c.alias]));

    const res = jsonOk({
      success: true,
      chats: activeSecretChats.map((chat) => {
        const peerPart = chat.participants.find((p) => p.userId !== user.id) || chat.participants[0];
        const creatorPart = chat.participants.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] || chat.participants[0];
        const isCreator = creatorPart?.userId === user.id;
        const alias = contactMap.get(peerPart.userId);
        return {
          id: chat.id,
          title: chat.title,
          expiresAt: chat.expiresAt ? chat.expiresAt.toISOString() : null,
          lifetimeSeconds: chat.lifetimeSeconds,
          codeword: chat.codeword ?? null,
          isApproved: chat.isApproved,
          isCreator,
          participants: chat.participants.map((p) => p.user),
          peer: {
            ...peerPart.user,
            displayName: alias || peerPart.user.displayName,
            contactAlias: alias || null,
          },
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
