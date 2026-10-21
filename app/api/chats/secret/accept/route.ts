import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { requireSecretChatAccess } from "@/lib/server/secret-chat-access";
import { secretDeviceKeySchema } from "@/lib/server/secret-device-keys";

const acceptSecretChatSchema = z.object({
  secretChatId: z.string().min(1).max(128),
  deviceKey: secretDeviceKeySchema.optional(),
  expectedCreatorPublicKey: z.string().max(2048).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    const body = acceptSecretChatSchema.parse(await readJsonBody(req, 128 * 1024));

    // Find the secret chat and make sure user is a participant
    const secretChat = await prisma.secretChat.findUnique({
      where: { id: body.secretChatId },
      include: {
        participants: true,
      },
    });

    if (!secretChat) {
      throw new HttpError(404, "Секретный чат не найден");
    }

    const participant = requireSecretChatAccess(secretChat, user.id, sessionId, true);
    if (secretChat.isApproved || participant.acceptedSessionId) {
      throw new HttpError(409, "Запрос уже принят или ожидает подтверждения собеседником");
    }
    if (secretChat.participants.length !== 2 || secretChat.participants.filter((p) => p.acceptedSessionId).length !== 1) {
      throw new HttpError(409, "Некорректное состояние запроса");
    }
    if (secretChat.cryptoVersion === 2) {
      const creator = secretChat.participants.find(p => p.acceptedSessionId);
      if (!body.deviceKey || !creator?.deviceKeyId || !creator.devicePublicKey || body.expectedCreatorPublicKey !== creator.devicePublicKey) {
        throw new HttpError(409, "Обновите запрос и проверьте ключ создателя секретного чата");
      }
      if (body.deviceKey.deviceKeyId === creator.deviceKeyId || body.deviceKey.devicePublicKey === creator.devicePublicKey) {
        throw new HttpError(400, "Устройства должны использовать разные ключи");
      }
    }

    // Calculate expiresAt
    const expiresAt = new Date(Date.now() + secretChat.lifetimeSeconds * 1000);

    // Update in database transaction
    await prisma.$transaction(async (tx) => {
      // Claim the pending invitation atomically. Concurrent/replayed accepts
      // must never change either the deadline or the accepted session.
      const claimed = await tx.secretChat.updateMany({
        where: { id: secretChat.id, isApproved: false, expiresAt: null },
        data: { isApproved: true, expiresAt },
      });
      if (claimed.count !== 1) throw new HttpError(409, "Запрос уже принят");
      // 1. Update the participant's acceptedSessionId
      await tx.secretChatParticipant.update({
        where: {
          secretChatId_userId: {
            secretChatId: secretChat.id,
            userId: user.id,
          },
        },
        data: {
          acceptedSessionId: sessionId,
          ...(secretChat.cryptoVersion === 2 ? {
            deviceKeyId: body.deviceKey!.deviceKeyId,
            devicePublicKey: body.deviceKey!.devicePublicKey,
          } : {}),
        },
      });

    });

    // The committed expiresAt is picked up by the durable PostgreSQL sweeper.

    // Trigger realtime event for all participants
    await Promise.all(
      secretChat.participants.map(async (p) => {
        try {
          await triggerRealtimeEvent({
            channel: userPrivateChannel(p.userId),
            name: "secret:accepted",
            data: {
              secretChatId: secretChat.id,
              expiresAt: expiresAt.toISOString(),
            },
          });
        } catch (e) {
          console.error("Failed to trigger realtime event for user", p.userId, e);
        }
      })
    );

    const res = jsonOk({
      success: true,
      chat: {
        id: secretChat.id,
        isApproved: true,
        expiresAt: expiresAt.toISOString(),
        lifetimeSeconds: secretChat.lifetimeSeconds,
      },
      expiresAt: expiresAt.toISOString(),
    });

    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
