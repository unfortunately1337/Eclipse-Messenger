import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { emailSchema } from "@/lib/server/validation";
import { hashOtpCode } from "@/lib/server/otp";
import { createPasswordReset, setPasswordResetCookie } from "@/lib/server/password-reset";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/),
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = schema.parse(await readJsonBody(req));
    await enforceRateLimit({
      key: `auth:password-reset:verify:ip:${clientIp(req)}`,
      limit: 20,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток проверки кода",
    });
    await enforceRateLimit({
      key: `auth:password-reset:verify:email:${body.email}`,
      limit: 8,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток проверки кода для этого email",
    });
    const now = new Date();
    const codeHash = hashOtpCode(body.code);

    const record = await prisma.emailCode.findFirst({
      where: {
        email: body.email,
        code: codeHash,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!record) {
      throw new HttpError(401, "Неверный или истекший код");
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true },
    });

    if (!user?.email) {
      throw new HttpError(404, "Аккаунт не найден");
    }

    await prisma.emailCode.deleteMany({ where: { email: body.email } });

    const token = await createPasswordReset(user.id, user.email);
    const res = jsonOk({ redirectTo: "/reset-password" });
    ensureCsrfCookie(req, res);
    setPasswordResetCookie(res, token);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
