import { readRequestBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";
import {
  canViewerSeeLastSeen,
  canViewerSeePresence,
  getPrivacyDisplayName,
  getPrivacySettingsBatch,
  profileCacheKey,
  shouldHideUsername,
} from "@/lib/server/privacy-settings";

const bodySchema = z.object({
  userIds: z.array(z.string().trim().min(1).max(128)).min(1).max(200),
});

type ProfilePreview = {
  id: string;
  link: string;
  secondaryLinks?: string[];
  displayName: string;
  avatarUrl: string | null;
  presenceVisibility?: "all" | "none";
  lastSeenVisibility?: "all" | "none";
  createdAt: string;
};

const PROFILE_CACHE_TTL_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const rawBody = new TextDecoder().decode(await readRequestBody(req, 128 * 1024));
    if (!rawBody.trim()) {
      const res = jsonOk({ profiles: [] satisfies ProfilePreview[] });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Некорректное тело запроса");
    }
    const body = bodySchema.parse(parsedBody);
    const uniqueIds = Array.from(new Set(body.userIds.map((id) => id.trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return applyCors(req, jsonOk({ profiles: [] satisfies ProfilePreview[] }));
    }

    // Privacy is always resolved for this viewer; only raw profile data is cached.
    const [privacyById, rawProfiles] = await Promise.all([
      getPrivacySettingsBatch(uniqueIds),
      redis.mget(...uniqueIds.map(profileCacheKey)),
    ]);
    const cachedResults = rawProfiles.map((raw, index) => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as ProfilePreview;
          if (parsed?.id !== uniqueIds[index] || !Array.isArray(parsed.secondaryLinks)) return null;
          return parsed;
        } catch {
          return null;
        }
      });

    const profiles: ProfilePreview[] = [];
    const missingIds: string[] = [];
    cachedResults.forEach((profile, index) => {
      if (profile) {
        profiles.push(profile);
      } else {
        missingIds.push(uniqueIds[index]!);
      }
    });

    if (missingIds.length > 0) {
      const rows = await prisma.user.findMany({
        where: { id: { in: missingIds } },
        select: {
          id: true,
          link: true,
          link2: true,
          link3: true,
          link4: true,
          link5: true,
          displayName: true,
          avatarUrl: true,
          presenceVisibility: true,
          createdAt: true,
        },
      });

      const fetched: ProfilePreview[] = rows.map((row): ProfilePreview => ({
        id: row.id,
        link: row.link,
        secondaryLinks: [row.link2, row.link3, row.link4, row.link5].filter(
          (l): l is string => typeof l === "string" && l.trim().length > 0,
        ),
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        presenceVisibility: (row.presenceVisibility === "none" ? "none" : "all") as "all" | "none",
        createdAt: row.createdAt.toISOString(),
      }));

      profiles.push(...fetched);
      await Promise.all(
        fetched.map((profile) =>
          redis.set(profileCacheKey(profile.id), JSON.stringify(profile), "EX", PROFILE_CACHE_TTL_SECONDS),
        ),
      );
    }

    const resolvedProfiles = profiles.map((profile) => {
        const settings = privacyById.get(profile.id)!;
        const canSeePresence = canViewerSeePresence(user.id, profile.id, settings);
        const canSeeLastSeen = canViewerSeeLastSeen(user.id, profile.id, settings);
        const isUsernameHidden = shouldHideUsername(user.id, profile.id, settings);
        return {
          ...profile,
          displayName: getPrivacyDisplayName(user.id, profile.id, profile.displayName, settings),
          presenceVisibility: (canSeePresence ? "all" : "none") as "all" | "none",
          lastSeenVisibility: (canSeeLastSeen ? "all" : "none") as "all" | "none",
          usernameHidden: isUsernameHidden,
          secondaryLinks: isUsernameHidden ? [] : (profile.secondaryLinks ?? []),
        };
      });

    const res = jsonOk({ profiles: resolvedProfiles });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
