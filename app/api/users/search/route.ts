import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";
import { normalizeLink } from "@/lib/server/validation";
import { ECLIPSE_DIALOG_LINK, ECLIPSE_DIALOG_TITLE, SAVED_DIALOG_LINK, SAVED_DIALOG_TITLE } from "@/lib/server/chat";
import { matchesEclipseDialogQuery } from "@/lib/server/eclipse-dialog-search";
import { matchesSavedDialogQuery } from "@/lib/server/saved-dialog-search";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { getPrivacyDisplayName, getPrivacySettingsBatch, type PrivacySettings } from "@/lib/server/privacy-settings";

const schema = z.object({
  q: z.string().trim().min(1).max(32),
});

const SEARCH_RESULT_CACHE_TTL_SECONDS = 30;
const SEARCH_CACHE_TIMEOUT_MS = 180;
const SEARCH_PRIVACY_TIMEOUT_MS = 220;


function searchResultCacheKey(userId: string, query: string) {
  return `search:users:v10:${userId}:${query}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function getSearchPrivacySettings(userIds: string[]) {
  // A slow privacy store must hide results, never publish them with permissive defaults.
  return withTimeout(getPrivacySettingsBatch(userIds), SEARCH_PRIVACY_TIMEOUT_MS, new Map<string, PrivacySettings>());
}

function normalizeHumanQuery(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function splitSearchTokens(value: string) {
  return normalizeHumanQuery(value)
    .toLowerCase()
    .split(/[\s._-]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildLinkSearchClauses(query: string, includeSecondary = false) {
  if (query.length < 1) return [];
  const fields = includeSecondary
    ? (["link", "link2", "link3", "link4", "link5"] as const)
    : (["link"] as const);

  const clauses: Array<Record<string, { startsWith?: string; contains?: string; mode: "insensitive" }>> = [];
  for (const field of fields) {
    if (query.length === 1 || query.length === 2) {
      clauses.push({ [field]: { startsWith: query, mode: "insensitive" as const } });
    } else {
      clauses.push({ [field]: { startsWith: query, mode: "insensitive" as const } });
      clauses.push({ [field]: { contains: query, mode: "insensitive" as const } });
    }
  }
  return clauses;
}

function buildTitleSearchClauses(field: "displayName" | "name", rawQuery: string, tokens: string[]) {
  const clauses: Array<Record<string, { startsWith?: string; contains?: string; mode: "insensitive" }>> = [];
  if (rawQuery.length >= 1) {
    clauses.push({ [field]: { startsWith: rawQuery, mode: "insensitive" as const } });
  }
  if (rawQuery.length >= 2) {
    clauses.push({ [field]: { contains: rawQuery, mode: "insensitive" as const } });
  }
  tokens
    .filter((token) => token.length >= 2)
    .slice(0, 3)
    .forEach((token) => {
      clauses.push({ [field]: { contains: token, mode: "insensitive" as const } });
    });
  return clauses;
}

function requiredLinkQueryLength(link: string) {
  const length = normalizeLink(link).length;
  if (length <= 5) return 2;
  if (length <= 9) return 3;
  if (length <= 15) return 4;
  return 5;
}

function linkPassesQueryThreshold(linkRaw: string, queryRaw: string) {
  const link = normalizeLink(linkRaw);
  const query = normalizeLink(queryRaw);
  if (!link || !query) return false;
  if (link === query) return true;
  if (query.length === 1) return link.startsWith(query);

  const requiredLength = requiredLinkQueryLength(link);
  if (query.length < requiredLength) {
    return false;
  }

  if (link.startsWith(query)) {
    return true;
  }

  return query.length >= requiredLength + 1 && link.includes(query);
}

function titlePassesQuery(titleRaw: string | null | undefined, rawQuery: string, tokens: string[]) {
  const title = normalizeHumanQuery(titleRaw ?? "").toLowerCase();
  const query = normalizeHumanQuery(rawQuery).toLowerCase();
  if (!title || query.length < 1) return false;
  if (title === query || title.startsWith(query)) return true;
  if (query.length >= 3 && title.includes(query)) return true;

  const titleTokens = splitSearchTokens(title);
  const queryTokens = tokens.filter((token) => token.length >= 2);
  return queryTokens.length > 0 && queryTokens.every((token) => titleTokens.some((part) => part.startsWith(token) || part.includes(token)));
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const parsed = schema.parse({
      q: req.nextUrl.searchParams.get("q") ?? "",
    });
    const rawQuery = normalizeHumanQuery(parsed.q);
    const query = normalizeLink(rawQuery);
    const tokens = splitSearchTokens(rawQuery);
    if (!query) {
      const emptyRes = jsonOk({ users: [], groups: [], channels: [], saved: [] });
      emptyRes.headers.set("Cache-Control", "private, no-store");
      return applyCors(req, emptyRes);
    }
    const cacheKey = searchResultCacheKey(user.id, query);
    try {
      const raw = await withTimeout(redis.get(cacheKey), SEARCH_CACHE_TIMEOUT_MS, null);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          users: unknown[];
          groups: unknown[];
          channels: unknown[];
          saved: unknown[];
        };
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.groups) && Array.isArray(parsed.channels) && Array.isArray(parsed.saved)) {
          const cachedUsers = parsed.users.filter((candidate): candidate is { id: string; link: string; displayName: string; secondaryLinks?: string[] } =>
            Boolean(candidate && typeof candidate === "object" && "id" in candidate && typeof candidate.id === "string" && "link" in candidate && typeof candidate.link === "string" && "displayName" in candidate && typeof candidate.displayName === "string"));
          const privacyById = await getSearchPrivacySettings(cachedUsers.map(candidate => candidate.id));
          parsed.users = cachedUsers.filter(candidate => {
            const privacy = privacyById.get(candidate.id);
            const usernameMatched = [candidate.link, ...(candidate.secondaryLinks ?? [])].some(link => linkPassesQueryThreshold(link, query));
            return privacy?.showInGlobalSearch && (!usernameMatched || privacy.allowUsernameSearch || titlePassesQuery(candidate.displayName, rawQuery, tokens));
          });
          const cachedGroups = parsed.groups.filter((candidate): candidate is { id: string } => Boolean(candidate && typeof candidate === "object" && "id" in candidate && typeof candidate.id === "string"));
          if (cachedGroups.length) {
            const current = await prisma.group.findMany({ where: { id: { in: cachedGroups.map(group => group.id) }, isPublic: true }, select: { id: true } });
            const visibleIds = new Set(current.map(group => group.id));
            parsed.groups = cachedGroups.filter(group => visibleIds.has(group.id));
          }
          // Bot profiles can be deleted while a search result is still cached.
          const cachedBots = parsed.users.filter((candidate): candidate is { id: string; isBot: true } =>
            Boolean(candidate && typeof candidate === "object" && "isBot" in candidate && candidate.isBot === true && "id" in candidate && typeof candidate.id === "string"));
          if (cachedBots.length) {
            const existing = await prisma.user.findMany({ where: { id: { in: cachedBots.map(bot => bot.id) } }, select: { id: true } });
            const missing = new Set(cachedBots.map(bot => bot.id).filter(id => !existing.some(candidate => candidate.id === id)));
            parsed.users = parsed.users.filter(candidate => !(candidate && typeof candidate === "object" && "id" in candidate && missing.has(String(candidate.id))));
          }
          // Membership changes must not leave stale subscriber counts in cached search results.
          const cachedChannels = parsed.channels.filter((candidate): candidate is { id: string } =>
            Boolean(candidate && typeof candidate === "object" && "id" in candidate && typeof candidate.id === "string"));
          if (cachedChannels.length) {
            const current = await prisma.channel.findMany({
              where: { id: { in: cachedChannels.map(channel => channel.id) }, OR: [{ isPublic: true }, { ownerId: user.id }, { subscribers: { some: { userId: user.id } } }] },
              select: { id: true, _count: { select: { subscribers: true } } },
            });
            const counts = new Map(current.map(channel => [channel.id, String(channel._count.subscribers)]));
            parsed.channels = cachedChannels.filter(channel => counts.has(channel.id)).map(channel => ({ ...channel, subscribersCount: counts.get(channel.id)! }));
          }
          const cachedRes = jsonOk(parsed);
          cachedRes.headers.set("Cache-Control", "private, no-store");
          return applyCors(req, cachedRes);
        }
      }
    } catch {
      // best-effort cache read
    }
    const baseWhere = {
      id: { not: user.id },
      isSystemAccount: false,
      NOT: { link: { equals: "eclipseaibot", mode: "insensitive" } },
    } as const;

    const select = {
      id: true,
      link: true,
      link2: true,
      link3: true,
      link4: true,
      link5: true,
      displayName: true,
      isBot: true,
      avatarUrl: true,
    } as const;

    const isShortQuery = query.length <= 3;
    const userLinkClauses = buildLinkSearchClauses(query, true);
    const groupLinkClauses = buildLinkSearchClauses(query, false);
    const userTitleClauses = buildTitleSearchClauses("displayName", rawQuery, tokens);
    const groupTitleClauses = buildTitleSearchClauses("name", rawQuery, tokens);
    const userWhere = [...userLinkClauses, ...userTitleClauses];
    const groupWhere = [...groupLinkClauses, ...groupTitleClauses];

    const [rawUsers, rawGroups, rawChannels] = await Promise.all([
      prisma.user.findMany({
        where: {
          ...baseWhere,
          OR: userWhere,
        },
        orderBy: { link: "asc" },
        take: isShortQuery ? 24 : 48,
        select,
      }),
      prisma.group.findMany({
        where: {
          isPublic: true,
          OR: groupWhere,
        },
        orderBy: { link: "asc" },
        take: isShortQuery ? 18 : 36,
        select: {
          id: true,
          link: true,
          name: true,
          avatarUrl: true,
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      prisma.channel.findMany({
        where: {
          isPublic: true,
          OR: groupWhere,
        },
        orderBy: { link: "asc" },
        take: isShortQuery ? 18 : 36,
        select: {
          id: true,
          link: true,
          name: true,
          avatarUrl: true,
          _count: {
            select: {
              subscribers: true,
            },
          },
        },
      }),
    ]);

    function scoreEntity(
      linkRaw: string,
      titleRaw: string | null | undefined,
      options?: { titleSearchEnabled?: boolean },
    ) {
      const link = linkRaw.toLowerCase();
      const title = normalizeHumanQuery(titleRaw ?? "").toLowerCase();
      const q = query.toLowerCase();
      const titleSearchEnabled = options?.titleSearchEnabled ?? true;
      const entityTokens = splitSearchTokens(titleSearchEnabled ? `${link} ${title}` : link);

      let score = 0;
      if (link === q) score += 10_000;
      if (titleSearchEnabled && title === q) score += 9_000;

      if (link.startsWith(q)) score += 4_000;
      if (titleSearchEnabled && title.startsWith(q)) score += 3_500;

      const linkTokenStarts = link.split(/[_\-. ]+/u).some((part) => part.startsWith(q));
      if (linkTokenStarts) score += 2_600;

      if (titleSearchEnabled) {
        const titleTokenStarts = title.split(/\s+/u).some((part) => part.startsWith(q));
        if (titleTokenStarts) score += 2_400;
      }

      const tokenCoverage = tokens.filter((token) => token.length >= 2).every((token) =>
        entityTokens.some((part) => part.startsWith(token)),
      );
      if (tokenCoverage) {
        score += 2_200;
      }

      const linkIndex = link.indexOf(q);
      if (linkIndex >= 0) score += Math.max(0, 1_500 - linkIndex * 20);

      if (titleSearchEnabled) {
        const titleIndex = title.indexOf(q);
        if (titleIndex >= 0) score += Math.max(0, 1_200 - titleIndex * 18);
      }

      score += Math.max(0, 300 - link.length);
      return score;
    }

    function getCandidateLinks<T extends { link: string }>(item: T): string[] {
      const anyItem = item as any;
      const list = [anyItem.link, anyItem.link2, anyItem.link3, anyItem.link4, anyItem.link5];
      return list.filter((l): l is string => typeof l === "string" && l.trim().length > 0);
    }

    function rankBySearch<T extends { link: string; displayName?: string | null; name?: string | null }>(
      items: T[],
      options?: { titleSearchEnabled?: boolean },
    ) {
      return items
        .filter((item) => {
          const title = "displayName" in item ? item.displayName : "name" in item ? item.name : "";
          const titleSearchEnabled = options?.titleSearchEnabled ?? true;
          const links = getCandidateLinks(item);
          const anyLinkPasses = links.some((l) => linkPassesQueryThreshold(l, query));
          return anyLinkPasses || (titleSearchEnabled && titlePassesQuery(title, rawQuery, tokens));
        })
        .slice()
        .sort((a, b) => {
          const aTitle = "displayName" in a ? a.displayName : "name" in a ? a.name : "";
          const bTitle = "displayName" in b ? b.displayName : "name" in b ? b.name : "";
          const aLinks = getCandidateLinks(a);
          const bLinks = getCandidateLinks(b);
          const aBestScore = Math.max(...aLinks.map((l) => scoreEntity(l, aTitle, options)), 0);
          const bBestScore = Math.max(...bLinks.map((l) => scoreEntity(l, bTitle, options)), 0);
          const scoreDiff = bBestScore - aBestScore;
          if (scoreDiff !== 0) return scoreDiff;
          if (a.link.length !== b.link.length) return a.link.length - b.link.length;
          return a.link.localeCompare(b.link);
        })
        .slice(0, isShortQuery ? 12 : 20);
    }

    const rankedUsers = rankBySearch(rawUsers);
    const privacyById = await getSearchPrivacySettings(rankedUsers.map(candidate => candidate.id));
    const users = (
      rankedUsers.map((candidate) => {
          const privacy = privacyById.get(candidate.id);
          if (!privacy) return null;
          const candidateLinks = getCandidateLinks(candidate);
          const usernameMatched = candidateLinks.some((l) => linkPassesQueryThreshold(l, query));
          const nameMatched = titlePassesQuery(candidate.displayName, rawQuery, tokens);
          if (!privacy.showInGlobalSearch || (usernameMatched && !privacy.allowUsernameSearch && !nameMatched)) return null;
          const secondaryLinks = [candidate.link2, candidate.link3, candidate.link4, candidate.link5].filter(
            (l): l is string => typeof l === "string" && l.trim().length > 0,
          );
          return {
            id: candidate.id,
            isBot: candidate.isBot,
            link: candidate.link,
            secondaryLinks,
            displayName: getPrivacyDisplayName(user.id, candidate.id, candidate.displayName, privacy),
            avatarUrl: candidate.avatarUrl,
          };
        })
    ).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    const groups = rankBySearch(rawGroups).map((group) => ({
      id: group.id,
      link: group.link,
      name: group.name,
      avatarUrl: group.avatarUrl ?? generateDefaultAvatarDataUrl(group.name, group.link),
      membersCount: String(group._count.members),
    }));
    const channels = rankBySearch(rawChannels).map((channel) => ({
      id: channel.id,
      link: channel.link,
      name: channel.name,
      avatarUrl: channel.avatarUrl ?? generateDefaultAvatarDataUrl(channel.name, channel.link),
      subscribersCount: String(channel._count.subscribers),
    }));
    const saved = matchesSavedDialogQuery(rawQuery)
      ? [{ id: `saved:${user.id}`, link: SAVED_DIALOG_LINK, title: SAVED_DIALOG_TITLE, avatarUrl: null }]
      : [];
    const eclipse = matchesEclipseDialogQuery(rawQuery)
      ? [{ id: `eclipse:${user.id}`, link: ECLIPSE_DIALOG_LINK, title: ECLIPSE_DIALOG_TITLE, avatarUrl: null, isSystem: true, isVerified: true }]
      : [];
    const payload = { users, groups, channels, saved, eclipse };
    try {
      // A transient privacy timeout must not poison the result cache for 30 seconds.
      if (rankedUsers.every(candidate => privacyById.has(candidate.id))) {
        await withTimeout(redis.set(cacheKey, JSON.stringify(payload), "EX", SEARCH_RESULT_CACHE_TTL_SECONDS), SEARCH_CACHE_TIMEOUT_MS, "OK");
      }
    } catch {
      // best-effort cache write
    }
    const res = jsonOk(payload);
    res.headers.set("Cache-Control", "private, no-store");
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
