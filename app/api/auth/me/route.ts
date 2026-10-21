import { NextRequest } from "next/server";
import { ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { requireUserFromRequest } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const res = jsonOk({
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
      createdAt: user.createdAt.toISOString(),
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
