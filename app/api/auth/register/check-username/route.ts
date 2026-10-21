import { NextRequest } from "next/server";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { enforceRateLimit } from "@/lib/server/rate-limit";

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit({
      key: `auth:check-username:ip:${clientIp(req)}`,
      limit: 60,
      windowSeconds: 60,
      message: "Слишком много запросов проверки имени, попробуйте позже",
    });

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username")?.trim().toLowerCase();

    if (!username) {
      return applyCors(req, jsonOk({ available: false }));
    }

    // Check if the username is taken in User, Channel, or Group
    const [existingUser, existingChannel, existingGroup] = await Promise.all([
      prisma.user.findFirst({
        where: {
          OR: [
            { link: username },
            { link2: username },
            { link3: username },
            { link4: username },
            { link5: username },
          ],
        },
        select: { id: true },
      }),
      prisma.channel.findUnique({
        where: { link: username },
        select: { id: true },
      }),
      prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Group"
        WHERE "link" = ${username}
        LIMIT 1
      `,
    ]);

    if (existingUser || existingChannel || existingGroup.length > 0) {
      return applyCors(req, jsonOk({ available: false }));
    }

    return applyCors(req, jsonOk({ available: true }));
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
