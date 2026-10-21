import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { redis } from "@/lib/server/redis";
import { prisma } from "@/lib/server/prisma";
import { DEFAULT_PRIVACY_SETTINGS, getPrivacySettings, profileCacheKey, savePrivacySettings, getPrivacyDisplayName, shouldHideUsername } from "@/lib/server/privacy-settings";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";

const audienceSchema = z.enum(["all", "contacts", "none"]);
const patchSchema = z.object({
  onlineVisibility: audienceSchema,
  lastSeenVisibility: audienceSchema,
  showTyping: z.boolean(),
  showMediaActivity: z.boolean(),
  showReadReceipts: z.boolean(),
  allowUsernameSearch: z.boolean(),
  showInGlobalSearch: z.boolean(),
  allowProfileLink: z.boolean(),
  allowGroupAdd: z.boolean(),
  firstMessagePolicy: audienceSchema,
  newChatAutoDeleteDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]),
  autoDeleteReadMessages: z.boolean(),
  hideUsername: z.boolean(),
  presenceExceptionUserIds: z.array(z.string().trim().max(128)).max(200).transform((items) => items.filter(Boolean)),
});

function toResponse(settings: Awaited<ReturnType<typeof getPrivacySettings>>) {
  const { contactUserIds: _contactUserIds, ...visible } = settings;
  return visible;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const current = await getPrivacySettings(user.id);
    const exceptionUsers =
      current.presenceExceptionUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: current.presenceExceptionUserIds } },
            select: { id: true, displayName: true, link: true, avatarUrl: true },
          })
        : [];
    const res = jsonOk({
      ...toResponse(current),
      presenceExceptionUsers: exceptionUsers,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function PATCH(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const current = await getPrivacySettings(user.id);
    const patchData = z.record(z.string(), z.unknown()).parse(await readJsonBody(req));
    const body = patchSchema.parse({ ...toResponse(current), ...patchData });
    const requestedExceptions = Array.from(new Set(body.presenceExceptionUserIds)).filter((id) => id !== user.id);
    const allowedExceptions =
      requestedExceptions.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: requestedExceptions } },
            select: { id: true, displayName: true, link: true, avatarUrl: true },
          })
        : [];
    const updated = await savePrivacySettings(user.id, {
      ...body,
      presenceExceptionUserIds: allowedExceptions.map((item) => item.id),
    });
    try {
      await redis.del(profileCacheKey(updated.id));
    } catch {
      // best-effort cache invalidation
    }
    try {
      const relatedDirectConversations = await prisma.conversation.findMany({
        where: { type: "direct", participants: { some: { userId: user.id } } },
        select: { participants: { select: { userId: true } } },
      });
      const relatedGroups = await prisma.groupMember.findMany({
        where: {
          group: {
            members: {
              some: { userId: user.id },
            },
          },
        },
        select: { userId: true },
      });
      const relatedUserIds = Array.from(
        new Set([
          user.id,
          ...relatedDirectConversations.flatMap((conversation) => conversation.participants.map((participant) => participant.userId)),
          ...relatedGroups.map((member) => member.userId),
        ]),
      );
      await invalidateChatListPayloadCache(relatedUserIds);

      void Promise.allSettled(
        relatedUserIds.map((userId) => {
          const fullSettings = { ...updated, contactUserIds: [] as string[] };
          const displayName = getPrivacyDisplayName(userId, user.id, user.displayName, fullSettings);
          const usernameHidden = shouldHideUsername(userId, user.id, fullSettings);
          return triggerRealtimeEvent({
            channel: userPrivateChannel(userId),
            name: "profile:updated",
            data: {
              id: user.id,
              link: user.link,
              displayName: displayName,
              avatarUrl: user.avatarUrl ?? generateDefaultAvatarDataUrl(displayName, user.link),
              backgroundUrl: user.backgroundUrl ?? null,
              usernameHidden: usernameHidden,
            },
          });
        })
      );
    } catch {
      // best-effort cache invalidation
    }
    const res = jsonOk({ ...updated, presenceExceptionUsers: allowedExceptions });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
