import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { deleteStoryById, getStoryAudienceUserIds, invalidateStoryFeedForUsers } from "@/lib/server/stories";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { id } = await params;
    const story = await prisma.story.findFirst({
      where: {
        id,
        authorId: user.id,
      },
      select: { id: true },
    });
    if (!story) {
      throw new HttpError(404, "История не найдена");
    }
    await deleteStoryById(story.id);
    void (async () => {
      try {
        const audienceUserIds = await getStoryAudienceUserIds(user.id);
        await invalidateStoryFeedForUsers([...audienceUserIds, user.id]);
      } catch (err) {
        console.warn("Failed to invalidate story feed caches:", err);
      }
    })();
    const res = jsonOk({ deleted: true, id: story.id });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
