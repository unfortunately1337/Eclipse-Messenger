import { NextRequest } from "next/server";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";
import { getSessionFromRequest } from "@/lib/server/session";
import { normalizeLink } from "@/lib/server/validation";
import { canViewerSeeLastSeen, canViewerSeePresence, getPrivacyDisplayName, getPrivacySettings, shouldHideUsername } from "@/lib/server/privacy-settings";
import { getMediaUploadedAt } from "@/lib/server/media-meta";

type Params = {
  params: Promise<{ link: string }>;
};

type CachedProfile = {
  isBot: boolean;
  id: string;
  link: string;
  secondaryLinks?: string[];
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  presenceVisibility: "all" | "none";
  lastSeenVisibility?: "all" | "none";
  musicUrl: string | null;
  musicTitle: string | null;
  musicAuthor: string | null;
  musicCoverUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  avatarUploadedAt?: string | null;
};

const PROFILE_PAGE_CACHE_TTL_SECONDS = 45;

function profilePageCacheKey(link: string) {
  return `profile:page:v3:${link}`;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { link } = await params;
    const normalized = normalizeLink(link);
    let viewerUserId: string | null = null;
    try {
      const session = await getSessionFromRequest(req);
      viewerUserId = session?.data.userId ?? null;
    } catch {
      viewerUserId = null;
    }

    const cacheKey = profilePageCacheKey(normalized);
    let profile: CachedProfile | null = null;
    try {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedProfile;
        if (parsed?.id && parsed?.link && Array.isArray(parsed.secondaryLinks)) {
          profile = parsed;
        }
      }
    } catch {
      profile = null;
    }

    if (!profile) {
      let user = await prisma.user.findFirst({
        where: { link: { equals: normalized, mode: "insensitive" } },
        select: {
          id: true,
          link: true,
          link2: true,
          link3: true,
          link4: true,
          link5: true,
          displayName: true,
          isBot: true,
          description: true,
          avatarUrl: true,
          backgroundUrl: true,
          presenceVisibility: true,
          musicUrl: true,
          musicTitle: true,
          musicAuthor: true,
          musicCoverUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { link2: { equals: normalized, mode: "insensitive" } },
              { link3: { equals: normalized, mode: "insensitive" } },
              { link4: { equals: normalized, mode: "insensitive" } },
              { link5: { equals: normalized, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            link: true,
            link2: true,
            link3: true,
            link4: true,
            link5: true,
            displayName: true,
            isBot: true,
            description: true,
            avatarUrl: true,
            backgroundUrl: true,
            presenceVisibility: true,
            musicUrl: true,
            musicTitle: true,
            musicAuthor: true,
            musicCoverUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      if (!user) {
        throw new HttpError(404, "Профиль не найден");
      }

      const secondaryLinks = Array.from(
        new Set(
          [user.link2, user.link3, user.link4, user.link5]
            .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
            .map((l) => l.trim())
            .filter((l) => l.toLowerCase() !== user.link.trim().toLowerCase()),
        ),
      );

      profile = {
        id: user.id,
        link: user.link,
        secondaryLinks,
        displayName: user.displayName,
        isBot: user.isBot,
        description: user.description,
        avatarUrl: user.avatarUrl,
        backgroundUrl: user.backgroundUrl,
        presenceVisibility: user.presenceVisibility === "none" ? "none" : "all",
        musicUrl: user.musicUrl,
        musicTitle: user.musicTitle,
        musicAuthor: user.musicAuthor,
        musicCoverUrl: user.musicCoverUrl,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
      try {
        await redis.set(cacheKey, JSON.stringify(profile), "EX", PROFILE_PAGE_CACHE_TTL_SECONDS);
        const canonicalKey = profilePageCacheKey(user.link.toLowerCase());
        if (cacheKey !== canonicalKey) {
          await redis.set(canonicalKey, JSON.stringify(profile), "EX", PROFILE_PAGE_CACHE_TTL_SECONDS);
        }
        for (const sec of secondaryLinks) {
          const secKey = profilePageCacheKey(sec.toLowerCase());
          if (secKey !== cacheKey && secKey !== canonicalKey) {
            await redis.set(secKey, JSON.stringify(profile), "EX", PROFILE_PAGE_CACHE_TTL_SECONDS);
          }
        }
      } catch {
        // best-effort cache write
      }
    }

    const privacySettings = await getPrivacySettings(profile.id);
    const canSeePresence = canViewerSeePresence(viewerUserId, profile.id, privacySettings);
    const canSeeLastSeen = canViewerSeeLastSeen(viewerUserId, profile.id, privacySettings);
    const avatarUploadedAt = viewerUserId === profile.id ? await getMediaUploadedAt(profile.avatarUrl) : null;
    const isUsernameHidden = shouldHideUsername(viewerUserId, profile.id, privacySettings);
    const res = jsonOk({
      ...profile,
      secondaryLinks: isUsernameHidden ? [] : profile.secondaryLinks,
      avatarUploadedAt: avatarUploadedAt ? avatarUploadedAt.toISOString() : null,
      displayName: getPrivacyDisplayName(viewerUserId, profile.id, profile.displayName, privacySettings),
      presenceVisibility: canSeePresence ? "all" : "none",
      lastSeenVisibility: canSeeLastSeen ? "all" : "none",
      usernameHidden: isUsernameHidden,
    });
    res.headers.set("Cache-Control", "private, no-store");

    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
