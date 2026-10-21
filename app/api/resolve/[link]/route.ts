import { getSessionFromRequest } from "@/lib/server/session";
import { getPrivacySettings, shouldHideUsername } from "@/lib/server/privacy-settings";
import { NextRequest } from "next/server";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";
import { normalizeLink } from "@/lib/server/validation";

type Params = {
  params: Promise<{ link: string }>;
};

type ResolvedEntity =
  | {
      type: "user";
      user: {
        id: string;
        link: string;
        secondaryLinks: string[];
        displayName: string;
        description: string | null;
        avatarUrl: string | null;
        backgroundUrl: string | null;
        presenceVisibility: "all" | "none";
        musicUrl: string | null;
        musicTitle: string | null;
        musicAuthor: string | null;
        musicCoverUrl: string | null;
        createdAt: string;
      };
    }
  | {
      type: "channel";
      channel: {
        id: string;
        link: string;
        name: string;
        avatarUrl: string | null;
      };
    }
  | {
      type: "group";
      group: {
        id: string;
        link: string;
        name: string;
        avatarUrl: string | null;
      };
    };

// Cache discovery, never the authorization decision: visibility may change immediately.
async function visibleEntity(req: NextRequest, entity: ResolvedEntity): Promise<ResolvedEntity> {
  const viewerId = (await getSessionFromRequest(req))?.data.userId;
  if (entity.type === "user") {
    const privacy = await getPrivacySettings(entity.user.id);
    if (viewerId !== entity.user.id && !privacy.allowProfileLink) throw new HttpError(404, "Ссылка не найдена");
    return shouldHideUsername(viewerId, entity.user.id, privacy)
      ? { ...entity, user: { ...entity.user, link: "", secondaryLinks: [] } }
      : entity;
  }
  const access = entity.type === "group"
    ? await prisma.group.findFirst({ where: { id: entity.group.id, OR: [{ isPublic: true }, ...(viewerId ? [{ ownerId: viewerId }, { members: { some: { userId: viewerId } } }] : [])] }, select: { id: true } })
    : await prisma.channel.findFirst({ where: { id: entity.channel.id, OR: [{ isPublic: true }, ...(viewerId ? [{ ownerId: viewerId }, { subscribers: { some: { userId: viewerId } } }] : [])] }, select: { id: true } });
  if (!access) throw new HttpError(404, "Ссылка не найдена");
  return entity;
}

const RESOLVE_CACHE_TTL_SECONDS = 60;

function resolveCacheKey(link: string) {
  return `resolve:v1:${link}`;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { link } = await params;
    const normalized = normalizeLink(link);
    if (!normalized) {
      throw new HttpError(400, "Некорректная ссылка");
    }

    const cacheKey = resolveCacheKey(normalized);
    let cached: ResolvedEntity | null = null;
    try {
      const raw = await redis.get(cacheKey);
      if (raw) cached = JSON.parse(raw) as ResolvedEntity;
    } catch { /* Discovery cache is optional. */ }
    if (cached?.type) return applyCors(req, jsonOk(await visibleEntity(req, cached)));

    // 1. Check user by primary link
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
        description: true,
        avatarUrl: true,
        backgroundUrl: true,
        presenceVisibility: true,
        musicUrl: true,
        musicTitle: true,
        musicAuthor: true,
        musicCoverUrl: true,
        createdAt: true,
      },
    });

    // 2. Check user by secondary links (link2..link5)
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
          description: true,
          avatarUrl: true,
          backgroundUrl: true,
          presenceVisibility: true,
          musicUrl: true,
          musicTitle: true,
          musicAuthor: true,
          musicCoverUrl: true,
          createdAt: true,
        },
      });
    }

    if (user) {
      const secondaryLinks = Array.from(
        new Set(
          [user.link2, user.link3, user.link4, user.link5]
            .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
            .map((l) => l.trim())
            .filter((l) => l.toLowerCase() !== user.link.trim().toLowerCase()),
        ),
      );

      const resolved: ResolvedEntity = {
        type: "user",
        user: {
          id: user.id,
          link: user.link,
          secondaryLinks,
          displayName: user.displayName,
          description: user.description,
          avatarUrl: user.avatarUrl,
          backgroundUrl: user.backgroundUrl,
          presenceVisibility: user.presenceVisibility === "none" ? "none" : "all",
          musicUrl: user.musicUrl,
          musicTitle: user.musicTitle,
          musicAuthor: user.musicAuthor,
          musicCoverUrl: user.musicCoverUrl,
          createdAt: user.createdAt.toISOString(),
        },
      };

      try {
        await redis.set(cacheKey, JSON.stringify(resolved), "EX", RESOLVE_CACHE_TTL_SECONDS);
        if (normalized !== user.link.toLowerCase()) {
          await redis.set(resolveCacheKey(user.link.toLowerCase()), JSON.stringify(resolved), "EX", RESOLVE_CACHE_TTL_SECONDS);
        }
      } catch {}

      const res = jsonOk(await visibleEntity(req, resolved));
      res.headers.set("Cache-Control", "private, no-store");
      return applyCors(req, res);
    }

    // 3. Check Channel
    const channel = await prisma.channel.findFirst({
      where: { link: { equals: normalized, mode: "insensitive" } },
      select: {
        id: true,
        link: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (channel) {
      const resolved: ResolvedEntity = {
        type: "channel",
        channel: {
          id: channel.id,
          link: channel.link,
          name: channel.name,
          avatarUrl: channel.avatarUrl,
        },
      };

      try {
        await redis.set(cacheKey, JSON.stringify(resolved), "EX", RESOLVE_CACHE_TTL_SECONDS);
      } catch {}

      const res = jsonOk(await visibleEntity(req, resolved));
      res.headers.set("Cache-Control", "private, no-store");
      return applyCors(req, res);
    }

    // 4. Check Group
    const groups = await prisma.$queryRaw<Array<{ id: string; link: string; name: string; avatarUrl: string | null }>>`
      SELECT "id", "link", "name", "avatarUrl"
      FROM "Group"
      WHERE LOWER("link") = ${normalized}
      LIMIT 1
    `;

    if (groups.length > 0) {
      const group = groups[0];
      const resolved: ResolvedEntity = {
        type: "group",
        group: {
          id: group.id,
          link: group.link,
          name: group.name,
          avatarUrl: group.avatarUrl,
        },
      };

      try {
        await redis.set(cacheKey, JSON.stringify(resolved), "EX", RESOLVE_CACHE_TTL_SECONDS);
      } catch {}

      const res = jsonOk(await visibleEntity(req, resolved));
      res.headers.set("Cache-Control", "private, no-store");
      return applyCors(req, res);
    }

    throw new HttpError(404, "Ссылка не найдена");
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
