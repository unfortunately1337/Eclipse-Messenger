import { expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createQrOwner, qrOwnerHash, requireQrOwner } from "./qr-login-owner";

it("requires the generating browser's secret rather than the visible QR token", () => {
  const response = NextResponse.json({});
  const hash = createQrOwner(new NextRequest("http://localhost/api/auth/qr/generate"), response);
  const secret = response.cookies.get("eclipse.qr-owner")!.value;
  const request = new NextRequest("http://localhost/api/auth/qr/status", { headers: { cookie: `eclipse.qr-owner=${secret}` } });
  expect(hash).toBe(qrOwnerHash(secret));
  expect(() => requireQrOwner(request, hash)).not.toThrow();
  expect(() => requireQrOwner(new NextRequest(request.url), hash)).toThrow("другому браузеру");
  expect(() => requireQrOwner(request, qrOwnerHash("f".repeat(64)))).toThrow("другому браузеру");
  expect(() => requireQrOwner(request, undefined)).toThrow();
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
