import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { linkSchema, normalizeLink } from "@/lib/server/validation";

const schema = z.object({
  link: linkSchema,
});

export async function GET(req: NextRequest) {
  try {
    await requireUserFromRequest(req);
    const parsed = schema.parse({
      link: req.nextUrl.searchParams.get("link") ?? "",
    });
    const link = normalizeLink(parsed.link);

    const [userTaken, groupTaken, channelTaken] = await Promise.all([
      prisma.user.findUnique({ where: { link }, select: { id: true } }),
      prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Group"
        WHERE "link" = ${link}
        LIMIT 1
      `,
      prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Channel"
        WHERE "link" = ${link}
        LIMIT 1
      `,
    ]);

    return applyCors(req, jsonOk({ available: !userTaken && groupTaken.length === 0 && channelTaken.length === 0 }));
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
