import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { HttpError } from "./http";

const cookieName = "eclipse.qr-owner";
const validSecret = /^[a-f0-9]{64}$/;
export function qrOwnerHash(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function createQrOwner(req: NextRequest, res: NextResponse) {
  const existing = req.cookies.get(cookieName)?.value;
  const secret = existing && validSecret.test(existing) ? existing : randomBytes(32).toString("hex");
  res.cookies.set(cookieName, secret, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth/qr", maxAge: 600 });
  return qrOwnerHash(secret);
}
export function requireQrOwner(req: NextRequest, expected: string | undefined) {
  const secret = req.cookies.get(cookieName)?.value;
  if (!expected || !secret || !validSecret.test(secret) || qrOwnerHash(secret) !== expected) throw new HttpError(403, "Этот QR-код принадлежит другому браузеру. Создайте новый код.");
}
