import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { canAccessStory, invalidateStoryFeedForUsers } from "@/lib/server/stories";

async function getStoryForLike(req: NextRequest, id: string) {
  verifyCsrf(req);
  const { user } = await requireUserFromRequest(req);
  const story = await canAccessStory(user.id, id);
  if (!story) {
    throw new HttpError(404, "История не найдена");
  }
  if (story.authorId === user.id) {
    throw new HttpError(400, "Нельзя лайкнуть свою историю");
  }
  return { user, story };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, story } = await getStoryForLike(req, id);

    await prisma.storyLike.upsert({
      where: {
        storyId_userId: {
          storyId: story.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        storyId: story.id,
        userId: user.id,
      },
    });

    const likesCount = await prisma.storyLike.count({
      where: { storyId: story.id },
    });
    await invalidateStoryFeedForUsers([user.id, story.authorId]);

    const res = jsonOk({ liked: true, likesCount });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, story } = await getStoryForLike(req, id);

    await prisma.storyLike.deleteMany({
      where: {
        storyId: story.id,
        userId: user.id,
      },
    });

    const likesCount = await prisma.storyLike.count({
      where: { storyId: story.id },
    });
    await invalidateStoryFeedForUsers([user.id, story.authorId]);

    const res = jsonOk({ liked: false, likesCount });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
