import type { NextRequest } from "next/server";
import { verifyCallJoinToken } from "@/lib/server/livekit";
import { authorizeSfuIdentity } from "@/lib/server/calls";

export const runtime = "nodejs";

// Caddy forward_auth preserves the original WebSocket URI in this header.
// Cookies and caller-supplied identities never authorize SFU access.
export async function GET(request: NextRequest) {
  try {
    const uri = request.headers.get("x-forwarded-uri") ?? "";
    if (uri.length > 16384) throw new Error("Invalid URI");
    const original = new URL(uri || "/rtc", "https://sfu.invalid");
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const token = original.searchParams.get("access_token") || bearer;
    if (!token || token.length > 8192) throw new Error("Missing token");
    const { id, identity } = await verifyCallJoinToken(token);
    await authorizeSfuIdentity(id, identity);
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never log the original URI, token, or SDK verification errors.
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}
