import { readJsonBody } from "@/lib/server/request-body";
import { assertCommunityLinkAvailable } from "@/lib/server/community-settings";
import { grantCommunityArtwork } from "@/lib/server/media-artwork";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { getContactsMap } from "@/lib/server/contacts";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { linkSchema } from "@/lib/server/validation";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(255).nullable().optional(),
  link: z.string().trim().optional().nullable(),
  isPublic: z.boolean().optional(),
  avatarUrl: z.string().trim().min(1).max(3_000_000).nullable().optional(),
  memberIds: z.array(z.string().min(1)).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const payload = bodySchema.parse(await readJsonBody(req, 4 * 1024 * 1024));
    const isPublic = payload.isPublic !== false;
    const normalizedLink = payload.link?.trim().replace(/^@+/, "").toLowerCase() ?? "";
    if (isPublic) {
      const linkResult = linkSchema.safeParse(normalizedLink);
      if (!linkResult.success) {
        throw new HttpError(400, "Некорректное имя канала");
      }

    }

    const contactsMap = await getContactsMap(user.id);
    const rawSelected = payload.memberIds ?? [];
    const selected = Array.from(new Set(rawSelected.filter((id) => id && id !== user.id)));
    const invited = selected.filter((id) => contactsMap.has(id));

    const created = await prisma.$transaction(async (tx) => {
      if (isPublic) await assertCommunityLinkAvailable(tx, normalizedLink);
      const channelLink = isPublic ? normalizedLink : randomUUID();
      const effectiveAvatarUrl =
        payload.avatarUrl?.trim() || generateDefaultAvatarDataUrl(payload.name.trim(), channelLink);
      const channel = await tx.channel.create({
        data: {
          id: randomUUID(),
          ownerId: user.id,
          link: channelLink,
          name: payload.name.trim(),
          description: payload.description || null,
          avatarUrl: effectiveAvatarUrl,
          isPublic,
        },
        select: {
          id: true,
          link: true,
          name: true,
          description: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      await grantCommunityArtwork(effectiveAvatarUrl, user.id, "channel", channel.id, tx);

      await tx.channelSubscriber.createMany({
        data: [
          {
            id: randomUUID(),
            channelId: channel.id,
            userId: user.id,
          },
          ...invited.map((memberId) => ({
            id: randomUUID(),
            channelId: channel.id,
            userId: memberId,
          })),
        ],
        skipDuplicates: true,
      });

      return channel;
    });

    const participantIds = Array.from(new Set([user.id, ...invited]));
    await Promise.all(
      participantIds.map(async (participantId) => {
        try {
          await triggerRealtimeEvent({
            channel: userPrivateChannel(participantId),
            name: "channel:added",
            data: {
              id: created.id,
              link: created.link,
              name: created.name,
        description: created.description,
              avatarUrl: created.avatarUrl,
              createdAt: created.createdAt.toISOString(),
              previewText: participantId === user.id ? "Вы создали канал" : "Вы были добавлены.",
            },
          });
        } catch {
          // ignore realtime transport failures
        }
      }),
    );

    await invalidateChatListPayloadCache(participantIds);

    const res = jsonOk({
      channel: {
        id: created.id,
        link: created.link,
        name: created.name,
        description: created.description,
        avatarUrl: created.avatarUrl,
        createdAt: created.createdAt.toISOString(),
      },
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
