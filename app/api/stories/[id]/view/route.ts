import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { canAccessStory, invalidateStoryFeedForUsers } from "@/lib/server/stories";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { id } = await params;
    const story = await canAccessStory(user.id, id);
    if (!story) {
      throw new HttpError(404, "История не найдена");
    }

    if (story.authorId !== user.id) {
      await prisma.storyView.upsert({
        where: {
          storyId_viewerId: {
            storyId: story.id,
            viewerId: user.id,
          },
        },
        update: {},
        create: {
          storyId: story.id,
          viewerId: user.id,
        },
      });
      await invalidateStoryFeedForUsers([user.id, story.authorId]);
    }

    const res = jsonOk({ ok: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
