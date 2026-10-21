import { readJsonBody } from "@/lib/server/request-body";
import { canUserStartConversation, getPrivacySettings } from "@/lib/server/privacy-settings";
import { requireOwnedPublicMedia } from "@/lib/server/owned-media";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { getOrCreateDirectConversation, findDirectConversation } from "@/lib/server/chat";

type Params = {
  params: Promise<{ link: string }>;
};

const wallpaperSchema = z.object({
  wallpaperUrl: z
    .string()
    .max(2048)
    .nullable()
    .refine(
      (val) =>
        val === null ||
        val.startsWith("/") ||
        val.startsWith("https://") ||
        val.startsWith("http://") ||
        val.startsWith("data:image/"),
      { message: "Недопустимый формат URL обоев" }
    ),
  wallpaperPosY: z.number().min(0).max(100).nullable(),
  notifyPeer: z.boolean().optional().default(true),
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;
    const body = wallpaperSchema.parse(await readJsonBody(req, 128 * 1024));

    // Resolve the peer from link
    const peer = await prisma.user.findFirst({
      where: {
        link: {
          equals: rawLink,
          mode: "insensitive",
        },
      },
      select: { id: true, displayName: true, avatarUrl: true, link: true },
    });

    if (!peer) {
      throw new HttpError(404, "User not found");
    }

    if (peer.id === user.id) {
      throw new HttpError(400, "Cannot set wallpaper with yourself");
    }

    const existingId = await findDirectConversation(user.id, peer.id);
    if (!existingId && !canUserStartConversation(user.id, peer.id, await getPrivacySettings(peer.id))) {
      throw new HttpError(403, "Пользователь запретил новые сообщения");
    }
    const wallpaperAsset = body.wallpaperUrl?.startsWith("/media/") || body.wallpaperUrl?.startsWith("/uploads/")
      ? await requireOwnedPublicMedia(body.wallpaperUrl, user.id, "image") : null;
    await enforceRateLimit({ key: `wallpaper:change:${user.id}`, limit: 30, windowSeconds: 60 });
    const conversationId = existingId ?? await getOrCreateDirectConversation(user.id, peer.id);
    if (wallpaperAsset && body.notifyPeer) {
      await prisma.mediaAssetAccess.upsert({
        where: { mediaAssetId_scopeType_scopeId: { mediaAssetId: wallpaperAsset.id, scopeType: "conversation", scopeId: conversationId } },
        create: { mediaAssetId: wallpaperAsset.id, scopeType: "conversation", scopeId: conversationId }, update: {},
      });
    }

    // Update ConversationParticipant for the current user
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      data: {
        wallpaperUrl: body.wallpaperUrl,
        wallpaperPosY: body.wallpaperPosY ?? 50,
      },
    });

    let systemMessage = null;

    if (body.wallpaperUrl && body.notifyPeer) {
      // Fetch sender info
      const sender = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, displayName: true, avatarUrl: true, link: true },
      });

      // Create a system message for wallpaper change
      systemMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          isSystemMessage: true,
          systemPayload: {
            eventType: "wallpaper_change",
            title: `${sender?.displayName ?? user.displayName} установил(а) новые обои в этом чате`,
            body: "",
            metadata: {
              senderId: user.id,
              senderName: sender?.displayName ?? user.displayName,
              senderAvatar: sender?.avatarUrl ?? null,
              senderLink: sender?.link ?? "",
              receiverId: peer.id,
              receiverName: peer.displayName ?? "",
              receiverAvatar: peer.avatarUrl ?? null,
              receiverLink: peer.link ?? "",
              wallpaperUrl: body.wallpaperUrl,
              wallpaperPosY: body.wallpaperPosY ?? 50,
            },
          },
        },
      });

      // Notify the receiver in real-time
      await triggerRealtimeEvent({
        channel: userPrivateChannel(peer.id),
        name: "message:new",
        data: {
          chatType: "direct",
          id: systemMessage.id,
          senderId: systemMessage.senderId,
          fromLink: user.link,
          fromDisplayName: user.displayName,
          isSystemMessage: true,
          systemPayload: systemMessage.systemPayload,
          createdAt: systemMessage.createdAt.toISOString(),
        },
      }).catch(() => {});
    }

    const res = jsonOk({
      success: true,
      wallpaperUrl: body.wallpaperUrl,
      wallpaperPosY: body.wallpaperPosY,
      message: systemMessage ? {
        id: systemMessage.id,
        senderId: systemMessage.senderId,
        text: "",
        isSystemMessage: true,
        systemPayload: systemMessage.systemPayload,
        createdAt: systemMessage.createdAt.toISOString(),
        reactions: [],
      } : null,
    });

    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
