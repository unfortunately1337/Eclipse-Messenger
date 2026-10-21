import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/server/constants";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  try {
    const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    const token = existing ?? randomUUID();
    const res = jsonOk({ csrfToken: token });

    if (!existing) {
      res.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
