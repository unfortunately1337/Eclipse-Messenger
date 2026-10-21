import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk, HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUserFromRequest(req);
    const { id } = await params;
    const parsedLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : null;

    const story = await prisma.story.findFirst({
      where: {
        id,
        authorId: user.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!story) {
      throw new HttpError(404, "История не найдена");
    }

    const [viewsCount, viewers] = await Promise.all([
      prisma.storyView.count({
        where: { storyId: story.id },
      }),
      prisma.storyView.findMany({
        where: { storyId: story.id },
        orderBy: { createdAt: "desc" },
        take: limit ?? undefined,
        select: {
          id: true,
          createdAt: true,
          viewer: {
            select: {
              id: true,
              link: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const likedUserIds = new Set(
      (
        await prisma.storyLike.findMany({
          where: { storyId: story.id, userId: { in: viewers.map((view) => view.viewer.id) } },
          select: { userId: true },
        })
      ).map((like) => like.userId),
    );

    const res = jsonOk({
      storyId: story.id,
      viewsCount,
      viewers: viewers.map((view) => ({
        id: view.viewer.id,
        link: view.viewer.link,
        displayName: view.viewer.displayName,
        avatarUrl: view.viewer.avatarUrl ?? null,
        viewedAt: view.createdAt.toISOString(),
        liked: likedUserIds.has(view.viewer.id),
      })),
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
