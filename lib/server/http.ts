import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function jsonOk(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json({ ok: true, data }, init);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export function jsonError(error: unknown) {
  if (error instanceof Error) {
    console.error(error);
  } else {
    console.error("Unknown error", error);
  }

  if (error instanceof Error && error.message.includes("ECLIPSE_KEY_ROTATION_REQUIRED")) {
    return NextResponse.json({ ok: false, error: "Состав чата изменился. Администратор должен обновить ключ шифрования; повторите отправку после обновления.", code: "KEY_ROTATION_REQUIRED" }, { status: 409 });
  }
  if (error instanceof Error && error.message.includes("ECLIPSE_MEMBERSHIP_REQUIRED")) {
    return NextResponse.json({ ok: false, error: "Вы больше не состоите в чате" }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ошибка валидации",
        details: error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  if (
    error instanceof HttpError ||
    (error &&
      typeof error === "object" &&
      "status" in error &&
      typeof (error as any).status === "number" &&
      "message" in error)
  ) {
    const httpError = error as any;
    return NextResponse.json(
      { ok: false, error: httpError.message, details: httpError.details ?? null },
      { status: httpError.status },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: false, error: "Внутренняя ошибка сервера" },
    { status: 500 },
  );
}

export function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function applyCors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  const allowed = parseAllowedOrigins();

  if (origin && allowed.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token");
  return res;
}

export function handleOptions(req: NextRequest) {
  return applyCors(req, new NextResponse(null, { status: 204 }));
}
