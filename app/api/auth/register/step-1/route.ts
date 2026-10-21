import { readJsonBody } from "@/lib/server/request-body";
import argon2 from "argon2";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { createPendingRegistration, setRegistrationCookie } from "@/lib/server/register";
import { getSessionFromRequest, getSecondarySessionFromRequest } from "@/lib/server/session";
import { emailSchema, passwordSchema } from "@/lib/server/validation";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    await enforceRateLimit({
      key: `auth:register-step1:ip:${clientIp(req)}`,
      limit: 15,
      windowSeconds: 60,
      message: "Слишком много попыток регистрации, попробуйте позже",
    });

    const body = schema.parse(await readJsonBody(req));

    if (body.password !== body.confirmPassword) {
      throw new HttpError(400, "Пароли не совпадают");
    }

    const session = await getSessionFromRequest(req);
    const secondarySession = await getSecondarySessionFromRequest(req);
    const exists = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, verified: true, createdAt: true },
    });

    if (exists) {
      if (
        (session && session.data.userId === exists.id) ||
        (secondarySession && secondarySession.data.userId === exists.id)
      ) {
        throw new HttpError(400, "Этот аккаунт уже добавлен на этом устройстве");
      }

      if (exists.verified) {
        throw new HttpError(409, "Email уже используется");
      }

      try {
        await prisma.user.delete({
          where: { id: exists.id },
        });
      } catch {
        // In case of any foreign relations, ignore
      }
    }

    const passwordHash = await argon2.hash(body.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const pendingToken = await createPendingRegistration(body.email, passwordHash);
    const res = jsonOk({ nextStep: "/sign-up" });
    ensureCsrfCookie(req, res);
    setRegistrationCookie(res, pendingToken);
    return applyCors(req, res);
  } catch (error) {
    console.error("Register step-1 error:", error);
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
