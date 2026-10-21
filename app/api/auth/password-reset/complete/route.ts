import { readJsonBody } from "@/lib/server/request-body";
import argon2 from "argon2";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { clearPasswordResetCookie, consumePasswordReset, getPasswordResetToken } from "@/lib/server/password-reset";
import { passwordSchema } from "@/lib/server/validation";
import { destroySessionById, listSessionsForUser } from "@/lib/server/session";

const schema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = schema.parse(await readJsonBody(req));
    const token = getPasswordResetToken(req);
    if (!token) {
      throw new HttpError(401, "Сессия сброса пароля истекла");
    }

    const pending = await consumePasswordReset(token);
    if (!pending) {
      throw new HttpError(401, "Сессия сброса пароля истекла");
    }

    const passwordHash = await argon2.hash(body.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.user.update({
      where: { id: pending.userId },
      data: { passwordHash },
      select: { id: true },
    });

    const sessions = await listSessionsForUser(pending.userId);
    await Promise.all(sessions.map((item) => destroySessionById(item.sessionId)));

    const res = jsonOk({ redirectTo: "/login" });
    ensureCsrfCookie(req, res);
    clearPasswordResetCookie(res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
