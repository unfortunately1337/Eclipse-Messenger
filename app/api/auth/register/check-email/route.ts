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
      key: `auth:check-email:ip:${clientIp(req)}`,
      limit: 60,
      windowSeconds: 60,
      message: "Слишком много запросов проверки email, попробуйте позже",
    });

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) {
      return applyCors(req, jsonOk({ available: false }));
    }

    // Check if the email is taken in User
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
      select: { id: true, verified: true, createdAt: true },
    });

    if (existingUser) {
      if (existingUser.verified) {
        return applyCors(req, jsonOk({ available: false }));
      }

      // If unverified
      const elapsedMs = Date.now() - existingUser.createdAt.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (elapsedMs < oneDayMs) {
        return applyCors(req, jsonOk({ available: false, reason: "Эта почта недавно использовалась, снова через 1 день" }));
      } else {
        return applyCors(req, jsonOk({ available: true }));
      }
    }

    return applyCors(req, jsonOk({ available: true }));
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
