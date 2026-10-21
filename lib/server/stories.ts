import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { deleteUnusedOwnedPublicMedia } from "./owned-media";
import { redis } from "@/lib/server/redis";
import { parseStoryOverlay } from "@/lib/story-overlay";

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const STORY_MAX_CAPTION_LENGTH = 280;
export const STORY_MAX_DURATION_MS = 15_000;
export const STORY_DEFAULT_TTL_HOURS = 24;
export const STORY_ALLOWED_TTL_HOURS = [6, 12, 24, 48] as const;
export const STORY_ALLOWED_MEDIA_TYPES = new Set(["image", "video"] as const);
const STORY_PURGE_INTERVAL_MS = 60_000;
const STORY_FEED_USER_IDS_CACHE_TTL_SEC = 5 * 60;
const STORY_FEED_CACHE_TTL_SEC = 10;

let purgeExpiredStoriesPromise: Promise<number> | null = null;
let lastStoryPurgeAt = 0;

export type StoryMediaType = "image" | "video";
export type StoryTtlHours = (typeof STORY_ALLOWED_TTL_HOURS)[number];

function normalizeStoryTtlHours(ttlHours?: number | null): StoryTtlHours {
  if (ttlHours && (STORY_ALLOWED_TTL_HOURS as readonly number[]).includes(ttlHours)) {
    return ttlHours as StoryTtlHours;
  }
  return STORY_DEFAULT_TTL_HOURS;
}

export async function deleteStoryById(storyId: string) {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, mediaUrl: true, authorId: true },
  });
  if (!story) return false;

  await prisma.story.delete({ where: { id: story.id } });

  await deleteUnusedOwnedPublicMedia(story.mediaUrl, story.authorId).catch(error => {
    console.warn("Story media cleanup failed", error);
  });

  return true;
}

export function buildStoryExpiry(createdAt = new Date(), ttlHours?: number | null) {
  return new Date(createdAt.getTime() + normalizeStoryTtlHours(ttlHours) * 60 * 60 * 1000);
}

export async function purgeExpiredStories(force = false) {
  const nowMs = Date.now();
  if (!force && nowMs - lastStoryPurgeAt < STORY_PURGE_INTERVAL_MS) {
    return 0;
  }
  if (purgeExpiredStoriesPromise) {
    return purgeExpiredStoriesPromise;
  }

  purgeExpiredStoriesPromise = (async () => {
  const expired = await prisma.story.findMany({
    where: { expiresAt: { lte: new Date() } },
    select: { id: true, mediaUrl: true },
  });
    if (!expired.length) {
      lastStoryPurgeAt = Date.now();
      return 0;
    }

    await Promise.allSettled(expired.map((story) => deleteStoryById(story.id)));
    lastStoryPurgeAt = Date.now();

    return expired.length;
  })().finally(() => {
    purgeExpiredStoriesPromise = null;
  });

  return purgeExpiredStoriesPromise;
}

export async function getStoryFeedUserIds(userId: string) {
  const cacheKey = `stories:feed-users:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // cache is best-effort
  }

  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT DISTINCT "userId"
    FROM (
      SELECT ${userId}::text AS "userId"
      UNION
      SELECT c."peerId" AS "userId"
      FROM "Contact" c
      WHERE c."ownerId" = ${userId}
      UNION
      SELECT cp2."userId" AS "userId"
      FROM "ConversationParticipant" cp1
      JOIN "Conversation" conv ON conv."id" = cp1."conversationId"
      JOIN "ConversationParticipant" cp2 ON cp2."conversationId" = cp1."conversationId"
      WHERE cp1."userId" = ${userId}
        AND conv."type" = 'direct'
    ) allowed_users
  `;

  const allowedUserIds = Array.from(new Set(rows.map((row) => row.userId).filter(Boolean)));
  try {
    await redis.set(cacheKey, JSON.stringify(allowedUserIds), "EX", STORY_FEED_USER_IDS_CACHE_TTL_SEC);
  } catch {
    // cache is best-effort
  }
  return allowedUserIds;
}

export async function getStoryAudienceUserIds(authorId: string) {
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT DISTINCT "userId"
    FROM (
      SELECT ${authorId}::text AS "userId"
      UNION
      SELECT c."ownerId" AS "userId"
      FROM "Contact" c
      WHERE c."peerId" = ${authorId}
      UNION
      SELECT cp2."userId" AS "userId"
      FROM "ConversationParticipant" cp1
      JOIN "Conversation" conv ON conv."id" = cp1."conversationId"
      JOIN "ConversationParticipant" cp2 ON cp2."conversationId" = cp1."conversationId"
      WHERE cp1."userId" = ${authorId}
        AND conv."type" = 'direct'
    ) viewers
  `;

  return Array.from(new Set(rows.map((row) => row.userId).filter(Boolean)));
}

function getStoryFeedCacheKey(userId: string) {
  return `stories:feed:${userId}`;
}

export async function invalidateStoryFeedForUsers(userIds: Array<string | null | undefined>) {
  const keys = Array.from(
    new Set(
      userIds
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map((userId) => getStoryFeedCacheKey(userId)),
    ),
  );
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // cache is best-effort
  }
}

export async function getActiveStoriesFeed(userId: string) {
  const feedCacheKey = getStoryFeedCacheKey(userId);
  try {
    const cached = await redis.get(feedCacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        void purgeExpiredStories().catch(() => {});
        return parsed;
      }
    }
  } catch {
    // cache is best-effort
  }

  void purgeExpiredStories().catch(() => {});
  const allowedUserIds = await getStoryFeedUserIds(userId);
  const now = new Date();
  const stories = await prisma.story.findMany({
    where: {
      authorId: { in: allowedUserIds },
      expiresAt: { gt: now },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      authorId: true,
      mediaUrl: true,
      mediaType: true,
      durationMs: true,
      caption: true,
      overlay: true,
      createdAt: true,
      expiresAt: true,
      author: {
        select: {
          id: true,
          link: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (stories.length === 0) {
    try {
      await redis.set(feedCacheKey, JSON.stringify([]), "EX", STORY_FEED_CACHE_TTL_SEC);
    } catch {
      // cache is best-effort
    }
    return [];
  }

  const storyIds = stories.map((story) => story.id);
  const ownStoryIds = stories.filter((story) => story.authorId === userId).map((story) => story.id);

  const [viewedRows, likedRows, viewCounts, likeCounts, ownStoryPreviewRows] = await Promise.all([
    prisma.storyView.findMany({
      where: {
        viewerId: userId,
        storyId: { in: storyIds },
      },
      select: { storyId: true },
    }),
    prisma.storyLike.findMany({
      where: {
        userId,
        storyId: { in: storyIds },
      },
      select: { storyId: true },
    }),
    prisma.storyView.groupBy({
      by: ["storyId"],
      where: { storyId: { in: storyIds } },
      _count: { storyId: true },
    }),
    prisma.storyLike.groupBy({
      by: ["storyId"],
      where: { storyId: { in: storyIds } },
      _count: { storyId: true },
    }),
    ownStoryIds.length > 0
      ? prisma.$queryRaw<Array<{
          storyId: string;
          viewerId: string;
          viewedAt: Date;
          link: string;
          displayName: string;
          avatarUrl: string | null;
        }>>`
          SELECT ranked."storyId",
                 ranked."viewerId",
                 ranked."createdAt" AS "viewedAt",
                 u."link",
                 u."displayName",
                 u."avatarUrl"
          FROM (
            SELECT sv."storyId",
                   sv."viewerId",
                   sv."createdAt",
                   ROW_NUMBER() OVER (PARTITION BY sv."storyId" ORDER BY sv."createdAt" DESC) AS rn
            FROM "StoryView" sv
            WHERE sv."storyId" IN (${Prisma.join(ownStoryIds)})
          ) ranked
          JOIN "User" u ON u."id" = ranked."viewerId"
          WHERE ranked.rn <= 3
          ORDER BY ranked."storyId", ranked."createdAt" DESC
        `
      : Promise.resolve([]),
  ]);

  const viewedStoryIds = new Set(viewedRows.map((row) => row.storyId));
  const likedStoryIds = new Set(likedRows.map((row) => row.storyId));
  const viewCountByStoryId = new Map(viewCounts.map((row) => [row.storyId, row._count.storyId]));
  const likeCountByStoryId = new Map(likeCounts.map((row) => [row.storyId, row._count.storyId]));
  const viewersPreviewByStoryId = ownStoryPreviewRows.reduce<
    Map<string, Array<{ id: string; link: string; displayName: string; avatarUrl: string | null; viewedAt: string }>>
  >((map, row) => {
    const current = map.get(row.storyId) ?? [];
    current.push({
      id: row.viewerId,
      link: row.link,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      viewedAt: row.viewedAt.toISOString(),
    });
    map.set(row.storyId, current);
    return map;
  }, new Map());

  const groups = new Map<
    string,
    {
      author: {
        id: string;
        link: string;
        displayName: string;
        avatarUrl: string | null;
      };
      stories: Array<{
        id: string;
        mediaUrl: string;
        mediaType: StoryMediaType;
        durationMs: number | null;
        caption: string | null;
        overlay: ReturnType<typeof parseStoryOverlay>;
        createdAt: string;
        expiresAt: string;
        viewed: boolean;
        isMine: boolean;
        viewsCount: number;
        viewersPreview: Array<{
          id: string;
          link: string;
          displayName: string;
          avatarUrl: string | null;
          viewedAt: string;
        }>;
        likedByMe: boolean;
        likesCount: number;
      }>;
      latestCreatedAt: number;
      hasUnviewed: boolean;
    }
  >();

  stories.forEach((story) => {
    const existing = groups.get(story.authorId);
    const item = {
      id: story.id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType as StoryMediaType,
      durationMs: story.durationMs ?? null,
      caption: story.caption ?? null,
      overlay: parseStoryOverlay(story.overlay),
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
      viewed: viewedStoryIds.has(story.id),
      isMine: story.authorId === userId,
      viewsCount: viewCountByStoryId.get(story.id) ?? 0,
      viewersPreview: viewersPreviewByStoryId.get(story.id) ?? [],
      likedByMe: likedStoryIds.has(story.id),
      likesCount: likeCountByStoryId.get(story.id) ?? 0,
    };
    if (!existing) {
      groups.set(story.authorId, {
        author: {
          id: story.author.id,
          link: story.author.link,
          displayName: story.author.displayName,
          avatarUrl: story.author.avatarUrl ?? null,
        },
        stories: [item],
        latestCreatedAt: story.createdAt.getTime(),
        hasUnviewed: !item.viewed,
      });
      return;
    }
    existing.stories.push(item);
    existing.latestCreatedAt = Math.max(existing.latestCreatedAt, story.createdAt.getTime());
    existing.hasUnviewed = existing.hasUnviewed || !item.viewed;
  });

  const feed = Array.from(groups.values())
    .sort((a, b) => {
      if (a.author.id === userId && b.author.id !== userId) return -1;
      if (b.author.id === userId && a.author.id !== userId) return 1;
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      return b.latestCreatedAt - a.latestCreatedAt;
    })
    .map((group) => ({
      author: group.author,
      hasUnviewed: group.hasUnviewed,
      stories: group.stories.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    }));

  try {
    await redis.set(feedCacheKey, JSON.stringify(feed), "EX", STORY_FEED_CACHE_TTL_SEC);
  } catch {
    // cache is best-effort
  }

  return feed;
}

export async function canAccessStory(userId: string, storyId: string) {
  await purgeExpiredStories();
  const story = await prisma.story.findFirst({
    where: {
      id: storyId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      authorId: true,
    },
  });
  if (!story) return null;
  const allowedUserIds = await getStoryFeedUserIds(userId);
  if (!allowedUserIds.includes(story.authorId)) return null;
  return story;
}
