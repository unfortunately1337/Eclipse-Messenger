import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getChatListPayload } from "@/lib/server/chat-list";
import { getActiveStoriesFeed } from "@/lib/server/stories";

const BOOTSTRAP_LIMIT = 34;
const BOOTSTRAP_LIMIT_MIN = 20;
const BOOTSTRAP_LIMIT_MAX = 60;

export async function GET(req: NextRequest) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    const stageParam = req.nextUrl.searchParams.get("stage")?.trim().toLowerCase();
    const stage = stageParam === "critical" || stageParam === "deferred" ? stageParam : "all";
    const parsedLimit = Number.parseInt(req.nextUrl.searchParams.get("chatLimit") ?? "", 10);
    const chatLimit = Number.isFinite(parsedLimit)
      ? Math.max(BOOTSTRAP_LIMIT_MIN, Math.min(parsedLimit, BOOTSTRAP_LIMIT_MAX))
      : BOOTSTRAP_LIMIT;

    const shouldIncludeChats = stage === "critical" || stage === "all";
    const shouldIncludeStories = stage === "deferred" || stage === "all";

    const [chatList, stories] = await Promise.all([
      shouldIncludeChats ? getChatListPayload(user.id, chatLimit, null, sessionId) : Promise.resolve(null),
      shouldIncludeStories ? getActiveStoriesFeed(user.id) : Promise.resolve(null),
    ]);

    const res = jsonOk({
      sessionId,
      me: {
        id: user.id,
        email: user.email ?? null,
        verified: user.verified ?? false,
        link: user.link,
        displayName: user.displayName,
        emojiStatusId: user.emojiStatusId ?? null,
        presenceVisibility: user.presenceVisibility === "none" ? "none" : "all",
        description: user.description,
        avatarUrl: user.avatarUrl,
        backgroundUrl: user.backgroundUrl,
        musicUrl: user.musicUrl,
        musicTitle: user.musicTitle,
        musicAuthor: user.musicAuthor,
        musicCoverUrl: user.musicCoverUrl,
        secondaryLinks: [user.link2, user.link3, user.link4, user.link5].filter((l): l is string => typeof l === "string" && l.trim().length > 0),
        createdAt: user.createdAt.toISOString(),
      },
      chats: chatList?.chats,
      hasMoreChats: chatList?.hasMore,
      chatsCursor: chatList?.nextCursor,
      stories: stories ?? undefined,
    });
    res.headers.set("Cache-Control", "private, no-store");
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
