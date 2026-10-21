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
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { getPrivacySettings } from "@/lib/server/privacy-settings";
import { linkSchema } from "@/lib/server/validation";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(255).nullable().optional(),
  link: z.string().trim().optional().nullable(),
  isPublic: z.boolean().optional(),
  avatarUrl: z.string().trim().min(1).max(3_000_000).nullable().optional(),
  memberIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const payload = bodySchema.parse(await readJsonBody(req, 4 * 1024 * 1024));
    const isPublic = Boolean(payload.isPublic);
    const normalizedLink = payload.link?.trim().replace(/^@+/, "").toLowerCase() ?? "";
    if (isPublic) {
      const linkResult = linkSchema.safeParse(normalizedLink);
      if (!linkResult.success) {
        throw new HttpError(400, "Некорректное имя группы");
      }

    }

    const contactsMap = await getContactsMap(user.id);
    const selected = Array.from(new Set(payload.memberIds.filter((id) => id && id !== user.id)));
    const contactsOnly = selected.filter((id) => contactsMap.has(id));
    const privacyByUserId = new Map(
      await Promise.all(
        contactsOnly.map(async (id) => [id, await getPrivacySettings(id)] as const),
      ),
    );
    const allowed = contactsOnly.filter((id) => privacyByUserId.get(id)?.allowGroupAdd !== false);
    if (allowed.length === 0) {
      throw new HttpError(400, "Добавьте хотя бы одного контакта");
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isPublic) await assertCommunityLinkAvailable(tx, normalizedLink);
      const groupId = randomUUID();
      const internalLink = isPublic ? normalizedLink : groupId;
      const effectiveAvatarUrl =
        payload.avatarUrl?.trim() || generateDefaultAvatarDataUrl(payload.name.trim(), internalLink);

      const group = await tx.group.create({
        data: {
          id: groupId,
          ownerId: user.id,
          link: internalLink,
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

      await grantCommunityArtwork(effectiveAvatarUrl, user.id, "group", group.id, tx);

      await tx.groupMember.createMany({
        data: [
          {
            id: randomUUID(),
            groupId: group.id,
            userId: user.id,
            role: "owner",
          },
          ...allowed.map((memberId) => ({
            id: randomUUID(),
            groupId: group.id,
            userId: memberId,
            role: "member",
          })),
        ],
      });

      return group;
    });

    const participantIds = Array.from(new Set([user.id, ...allowed]));
    await Promise.all(
      participantIds.map(async (participantId) => {
        try {
          await triggerRealtimeEvent({
            channel: userPrivateChannel(participantId),
            name: "group:added",
            data: {
              id: created.id,
              link: created.link,
              name: created.name,
        description: created.description,
              avatarUrl: created.avatarUrl,
              createdAt: created.createdAt.toISOString(),
              previewText: participantId === user.id ? "Вы создали группу" : "Вы были добавлены.",
            },
          });
        } catch {
          // ignore realtime transport failures
        }
      }),
    );

    await invalidateChatListPayloadCache(participantIds);

    const res = jsonOk({
      group: {
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
