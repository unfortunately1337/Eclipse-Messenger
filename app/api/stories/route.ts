import { requireOwnedPublicMedia } from "@/lib/server/owned-media";
import { enforceRollingRateLimit } from "@/lib/server/rate-limit";
import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import {
  buildStoryExpiry,
  getStoryAudienceUserIds,
  getActiveStoriesFeed,
  invalidateStoryFeedForUsers,
  STORY_ALLOWED_MEDIA_TYPES,
  STORY_ALLOWED_TTL_HOURS,
  STORY_DEFAULT_TTL_HOURS,
  STORY_MAX_CAPTION_LENGTH,
  STORY_MAX_DURATION_MS,
} from "@/lib/server/stories";
import { parseStoryOverlay, stringifyStoryOverlay } from "@/lib/story-overlay";

const mediaUrlSchema = z
  .string()
  .trim()
  .max(3_000_000)
  .refine(
    (value) => value.startsWith("/media/") || value.startsWith("/uploads/") || /^https?:\/\//i.test(value),
    "Некорректный медиа-файл",
  );

const createStorySchema = z.object({
  mediaUrl: mediaUrlSchema,
  mediaType: z.enum(["image", "video"]),
  durationMs: z.number().int().min(0).max(STORY_MAX_DURATION_MS).optional().nullable(),
  ttlHours: z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48)]).optional().default(STORY_DEFAULT_TTL_HOURS),
  caption: z.string().trim().max(STORY_MAX_CAPTION_LENGTH).optional().nullable(),
  overlay: z.unknown().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const feed = await getActiveStoriesFeed(user.id);
    const res = jsonOk({ stories: feed });
    res.headers.set("Cache-Control", "private, no-store");
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
    const body = createStorySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));

    if (!STORY_ALLOWED_MEDIA_TYPES.has(body.mediaType)) {
      throw new Error("Некорректный тип истории");
    }
    if (!STORY_ALLOWED_TTL_HOURS.includes(body.ttlHours)) {
      throw new Error("Некорректное время жизни истории");
    }
    if (body.mediaType === "video" && (!body.durationMs || body.durationMs > STORY_MAX_DURATION_MS)) {
      throw new HttpError(400, "История с видео может быть не длиннее 15 секунд");
    }

    await requireOwnedPublicMedia(body.mediaUrl, user.id, body.mediaType);

    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const uploadedIn48hCount = await prisma.story.count({
      where: {
        authorId: user.id,
        createdAt: {
          gte: fortyEightHoursAgo,
        },
      },
    });

    if (uploadedIn48hCount >= 6) {
      throw new HttpError(429, "Вы достигли лимита в 6 историй за 48 часов");
    }

    // The counter survives story deletion and prevents concurrent quota bypass.
    await enforceRollingRateLimit({ key: `stories:create:v2:${user.id}`, limit: 6, windowSeconds: 48 * 60 * 60, message: "Вы достигли лимита в 6 историй за 48 часов" });

    const story = await prisma.story.create({
      data: {
        authorId: user.id,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        durationMs: body.mediaType === "video" ? body.durationMs ?? null : null,
        caption: body.caption?.trim() || null,
        overlay: stringifyStoryOverlay(body.overlay),
        expiresAt: buildStoryExpiry(new Date(), body.ttlHours),
      },
      select: {
        id: true,
        mediaUrl: true,
        mediaType: true,
        durationMs: true,
        caption: true,
        overlay: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    void (async () => {
      try {
        const audienceUserIds = await getStoryAudienceUserIds(user.id);
        await invalidateStoryFeedForUsers([...audienceUserIds, user.id]);
      } catch (err) {
        console.warn("Failed to invalidate story feed caches on create:", err);
      }
    })();

    const res = jsonOk({
      story: {
        ...story,
        overlay: parseStoryOverlay(story.overlay),
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
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
