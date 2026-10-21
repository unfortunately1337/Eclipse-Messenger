import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/server/constants";
import { HttpError, parseAllowedOrigins } from "@/lib/server/http";

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

function requestOrigin(req: NextRequest) {
  // Next can construct nextUrl from its internal listen address behind a TLS
  // proxy. Host is the browser-facing authority; the proxy must preserve it
  // and overwrite X-Forwarded-Proto when it terminates HTTPS.
  const host = req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  if (/[\s,\\/@?#]/.test(host)) return null;

  const forwardedProtocol = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol ? `${forwardedProtocol}:` : req.nextUrl.protocol;
  if (protocol !== "http:" && protocol !== "https:") return null;
  try {
    return new URL(`${protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

export function ensureCsrfCookie(req: NextRequest, res: NextResponse) {
  const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const token = existing ?? randomUUID();

  if (!existing) {
    res.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return token;
}

export function verifyCsrf(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowedOrigins = parseAllowedOrigins();
  if ((origin && origin !== requestOrigin(req) && !allowedOrigins.includes(origin)) ||
      (!origin && req.headers.get("sec-fetch-site") === "cross-site")) {
    throw new HttpError(403, "CSRF проверка не пройдена");
  }
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = req.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new HttpError(403, "CSRF проверка не пройдена");
  }
}
