import { getEmojiStatus } from "@/lib/emoji-status";
import { readJsonBody } from "@/lib/server/request-body";
import { after, NextRequest } from "next/server";
import { z } from "zod";
import { invalidateUserCache, requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { LINK_REGEX } from "@/lib/server/constants";
import { normalizeLink } from "@/lib/server/validation";
import { getPrivacySettings, savePrivacySettings } from "@/lib/server/privacy-settings";
import { requireOwnedPublicMedia, deleteUnusedOwnedPublicMedia } from "@/lib/server/owned-media";
import { redis } from "@/lib/server/redis";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { triggerRealtimeChannels, userPrivateChannel } from "@/lib/server/realtime";
import {
  generateDefaultAvatarDataUrl,
  isDefaultAvatarDataUrl,
} from "@/lib/server/default-avatar";

const mediaUrlSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed.startsWith("blob:")) return null;
      return trimmed;
    }
    return value;
  },
  z.union([
    z.string().max(3_000_000),
    z.null(),
  ]),
);

const musicUrlSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed.startsWith("blob:")) return null;
      return trimmed;
    }
    return value;
  },
  z.union([
    z.string().max(3_000_000),
    z.null(),
  ]),
);

const musicTextSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  },
  z.union([z.string().max(120), z.null()]),
);

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  emojiStatusId: z.string().max(100).refine(id => getEmojiStatus(id) !== null, "Unknown emoji status").nullable().optional(),
  link: z.string().transform(normalizeLink).optional(),
  description: z.string().trim().max(280).optional().nullable(),
  avatarUrl: mediaUrlSchema.optional().nullable(),
  backgroundUrl: mediaUrlSchema.optional().nullable(),
  musicUrl: musicUrlSchema.optional().nullable(),
  musicTitle: musicTextSchema.optional().nullable(),
  musicAuthor: musicTextSchema.optional().nullable(),
  musicCoverUrl: mediaUrlSchema.optional().nullable(),
  usernameHidden: z.boolean().optional(),
});

function profileCacheKey(userId: string) {
  return `profile:preview:v2:${userId}`;
}

function extractMediaObjectKey(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/media/")) return null;
  return trimmed.slice("/media/".length);
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);

    let musicUrl: string | null = null;
    let musicTitle: string | null = null;
    let musicAuthor: string | null = null;
    let musicCoverUrl: string | null = null;
    try {
      const musicData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { musicUrl: true, musicTitle: true, musicAuthor: true, musicCoverUrl: true },
      });
      musicUrl = musicData?.musicUrl ?? null;
      musicTitle = musicData?.musicTitle ?? null;
      musicAuthor = musicData?.musicAuthor ?? null;
      musicCoverUrl = musicData?.musicCoverUrl ?? null;
    } catch {
      // schema mismatch during deploy
    }

    const privacy = await getPrivacySettings(user.id);
    const res = jsonOk({
      id: user.id,
      email: user.email ?? null,
      verified: user.verified ?? false,
      link: user.link,
      displayName: user.displayName,
      emojiStatusId: user.emojiStatusId ?? null,
      description: user.description,
      avatarUrl: user.avatarUrl,
      backgroundUrl: user.backgroundUrl,
      musicUrl,
      musicTitle,
      musicAuthor,
      musicCoverUrl,
      usernameHidden: privacy.hideUsername,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
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
    const body = patchSchema.parse(await readJsonBody(req, 16 * 1024 * 1024));

    // Fetch existing user fields from database so no field is lost
    const currentUserData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        displayName: true,
        emojiStatusId: true,
        link: true,
        description: true,
        avatarUrl: true,
        backgroundUrl: true,
        musicUrl: true,
        musicTitle: true,
        musicAuthor: true,
        musicCoverUrl: true,
      },
    });

    const currentDisplayName = currentUserData?.displayName ?? user.displayName;
    const currentLink = currentUserData?.link ?? user.link;
    const normalizedCurrentLink = normalizeLink(currentLink);

    const nextDisplayName = body.displayName !== undefined ? body.displayName : currentDisplayName;
    const nextLink = body.link !== undefined ? body.link : normalizedCurrentLink;
    const isLinkChanged = nextLink !== normalizedCurrentLink;

    const currentGeneratedAvatarUrl = generateDefaultAvatarDataUrl(currentDisplayName, normalizedCurrentLink);
    const currentAvatarUrl = currentUserData?.avatarUrl ?? user.avatarUrl ?? null;
    const nextRequestedAvatarUrl = body.avatarUrl === undefined ? currentAvatarUrl : body.avatarUrl || null;
    const avatarChangedManually = nextRequestedAvatarUrl !== currentAvatarUrl;
    const isCurrentGeneratedAvatar =
      currentAvatarUrl === currentGeneratedAvatarUrl || isDefaultAvatarDataUrl(currentAvatarUrl);
    const shouldRegenerateGeneratedAvatar =
      !avatarChangedManually &&
      (nextDisplayName !== currentDisplayName || isLinkChanged) &&
      isCurrentGeneratedAvatar;
    const nextAvatarUrl = shouldRegenerateGeneratedAvatar
      ? generateDefaultAvatarDataUrl(nextDisplayName, nextLink)
      : nextRequestedAvatarUrl;

    const nextBackgroundUrl = body.backgroundUrl !== undefined ? (body.backgroundUrl || null) : (currentUserData?.backgroundUrl ?? user.backgroundUrl ?? null);
    const nextDescription = body.description !== undefined ? (body.description?.trim() || null) : (currentUserData?.description ?? user.description ?? null);
    const nextMusicUrl = body.musicUrl !== undefined ? (body.musicUrl || null) : (currentUserData?.musicUrl ?? null);
    const nextMusicTitle = body.musicTitle !== undefined ? (body.musicTitle || null) : (currentUserData?.musicTitle ?? null);
    const nextMusicAuthor = body.musicAuthor !== undefined ? (body.musicAuthor || null) : (currentUserData?.musicAuthor ?? null);
    const nextMusicCoverUrl = body.musicCoverUrl !== undefined ? (body.musicCoverUrl || null) : (currentUserData?.musicCoverUrl ?? null);

    if (isLinkChanged && !LINK_REGEX.test(nextLink)) {
      throw new HttpError(400, "Уникальное имя должно начинаться с буквы, заканчиваться буквой или цифрой и содержать 4-32 символа: a-z, 0-9, _");
    }
    if (isLinkChanged) {
      const existingChannel = await prisma.channel.findUnique({
        where: { link: nextLink },
        select: { id: true },
      });
      if (existingChannel) {
        throw new HttpError(409, "Ссылка уже занята");
      }
      const existingUserByAnyLink = await prisma.user.findFirst({
        where: {
          id: { not: user.id },
          OR: [
            { link: nextLink },
            { link2: nextLink },
            { link3: nextLink },
            { link4: nextLink },
            { link5: nextLink },
          ],
        },
        select: { id: true },
      });
      if (existingUserByAnyLink) {
        throw new HttpError(409, "Ссылка уже занята");
      }
    }

    await Promise.all((["avatarUrl", "backgroundUrl", "musicUrl", "musicCoverUrl"] as const).map(async field => {
      const requested = body[field];
      if (requested && requested !== currentUserData?.[field] && (requested.startsWith("/media/") || requested.startsWith("/uploads/"))) {
        const asset = await requireOwnedPublicMedia(requested, user.id, field === "musicUrl" || field === "backgroundUrl" ? undefined : "image");
        if (field === "backgroundUrl" && asset.kind !== "image" && asset.kind !== "video") {
          throw new HttpError(400, "Для фона профиля выберите фото или видео");
        }
      }
    }));
    const privacy = await getPrivacySettings(user.id);

    const updated = await prisma.user.update({
      where: { id: user.id },
      // PATCH only the supplied fields. Concurrent edits to other fields must
      // not be overwritten by values from the earlier profile read.
      data: {
        ...(body.displayName !== undefined ? { displayName: nextDisplayName } : {}),
        ...(body.emojiStatusId !== undefined ? { emojiStatusId: body.emojiStatusId } : {}),
        ...(body.link !== undefined ? { link: nextLink } : {}),
        ...(body.description !== undefined ? { description: nextDescription } : {}),
        ...(body.avatarUrl !== undefined || shouldRegenerateGeneratedAvatar ? { avatarUrl: nextAvatarUrl } : {}),
        ...(body.backgroundUrl !== undefined ? { backgroundUrl: nextBackgroundUrl } : {}),
        ...(body.musicUrl !== undefined ? { musicUrl: nextMusicUrl } : {}),
        ...(body.musicTitle !== undefined ? { musicTitle: nextMusicTitle } : {}),
        ...(body.musicAuthor !== undefined ? { musicAuthor: nextMusicAuthor } : {}),
        ...(body.musicCoverUrl !== undefined ? { musicCoverUrl: nextMusicCoverUrl } : {}),
      },
      select: {
        id: true,
        link: true,
        link2: true,
        link3: true,
        link4: true,
        link5: true,
        displayName: true,
        emojiStatusId: true,
        description: true,
        avatarUrl: true,
        backgroundUrl: true,
        musicUrl: true,
        musicTitle: true,
        musicAuthor: true,
        musicCoverUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    invalidateUserCache(updated.id);

    if (body.usernameHidden !== undefined && privacy.hideUsername !== body.usernameHidden) {
      await savePrivacySettings(user.id, { ...privacy, hideUsername: body.usernameHidden });
      privacy.hideUsername = body.usernameHidden;
    }
    const linksToInvalidate = new Set<string>();
    [user.link, user.link2, user.link3, user.link4, user.link5, updated.link, updated.link2, updated.link3, updated.link4, updated.link5]
      .filter((l): l is string => Boolean(l && l.trim()))
      .forEach(l => linksToInvalidate.add(l.trim().toLowerCase()));
    await Promise.allSettled([
      redis.del(profileCacheKey(updated.id), ...Array.from(linksToInvalidate).map(l => `profile:page:v3:${l}`),
        `profile:details:${updated.id}`, `profile:preview:${updated.id}`),
      invalidateChatListPayloadCache(updated.id),
    ]);

    const secondaryLinks = [updated.link2, updated.link3, updated.link4, updated.link5].filter(
      (l): l is string => typeof l === "string" && l.trim().length > 0,
    );

    const res = jsonOk({
      ...updated,
      secondaryLinks,
      usernameHidden: privacy.hideUsername,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });

    // Next keeps peer synchronization and cleanup alive after the response.
    after(async () => {
      try {
        const [relatedDirectConversations, relatedGroups] = await Promise.all([
          prisma.conversation.findMany({
            where: {
              type: "direct",
              participants: {
                some: { userId: user.id },
              },
            },
            select: {
              participants: {
                select: { userId: true },
              },
            },
          }),
          prisma.groupMember.findMany({
            where: {
              group: {
                members: {
                  some: { userId: user.id },
                },
              },
            },
            select: { userId: true },
          }),
        ]);

        const relatedUserIds = Array.from(
          new Set([
            ...relatedDirectConversations.flatMap((conversation) => conversation.participants.map((participant) => participant.userId)),
            ...relatedGroups.map((member) => member.userId),
          ]),
        );

        if (relatedUserIds.length > 0) {
          await invalidateChatListPayloadCache(relatedUserIds);
          await triggerRealtimeChannels({
            channels: relatedUserIds.map(userPrivateChannel), name: "profile:updated",
                data: {
                  id: updated.id,
                  link: updated.link,
                  previousLink: user.link,
                  displayName: updated.displayName,
                  emojiStatusId: updated.emojiStatusId,
                  avatarUrl: updated.avatarUrl ?? generateDefaultAvatarDataUrl(updated.displayName, updated.link),
                  backgroundUrl: updated.backgroundUrl ?? null,
                  musicUrl: updated.musicUrl,
                  musicTitle: updated.musicTitle,
                  musicAuthor: updated.musicAuthor,
                  musicCoverUrl: updated.musicCoverUrl,
                  description: updated.description,
                  secondaryLinks,
                },
          }).catch(error => console.warn("Profile update notification failed:", error));
        }

        const previousAvatarKey = extractMediaObjectKey(currentUserData?.avatarUrl);
        const previousBannerKey = extractMediaObjectKey(currentUserData?.backgroundUrl);
        const previousMusicKey = extractMediaObjectKey(currentUserData?.musicUrl);
        const previousMusicCoverKey = extractMediaObjectKey(currentUserData?.musicCoverUrl);
        const nextAvatarKey = extractMediaObjectKey(updated.avatarUrl);
        const nextBannerKey = extractMediaObjectKey(updated.backgroundUrl);
        const nextMusicKey = extractMediaObjectKey(updated.musicUrl);
        const nextMusicCoverKey = extractMediaObjectKey(updated.musicCoverUrl);
        const objectKeysToDelete = [
          previousAvatarKey && previousAvatarKey !== nextAvatarKey ? previousAvatarKey : null,
          previousBannerKey && previousBannerKey !== nextBannerKey ? previousBannerKey : null,
          previousMusicKey && previousMusicKey !== nextMusicKey ? previousMusicKey : null,
          previousMusicCoverKey && previousMusicCoverKey !== nextMusicCoverKey ? previousMusicCoverKey : null,
        ].filter((key): key is string => Boolean(key));

        if (objectKeysToDelete.length > 0) {
          await Promise.allSettled(objectKeysToDelete.map((objectKey) => deleteUnusedOwnedPublicMedia(`/media/${objectKey}`, user.id)));
        }
      } catch (bgErr) {
        console.warn("Background profile sync error:", bgErr);
      }
    });

    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return applyCors(req, jsonError(new HttpError(409, "Ссылка уже занята")));
    }

    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
