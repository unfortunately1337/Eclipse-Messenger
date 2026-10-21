import { NextRequest } from "next/server";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getMediaUploadedAt } from "@/lib/server/media-meta";
import { requireUserFromRequest } from "@/lib/server/auth";
import { requireMediaAccess } from "@/lib/server/media-access";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const url = req.nextUrl.searchParams.get("url") || req.nextUrl.searchParams.get("key");
    if (!url) {
      const res = jsonOk({ uploadedAt: null });
      return applyCors(req, res);
    }

    const key = url.replace(/^\/media\//, "").replace(/^\/uploads\//, "uploads/").split(/[?#]/)[0];
    const asset = await requireMediaAccess(req, key);
    const date = asset.ownerId === user.id ? await getMediaUploadedAt(url) : null;
    const res = jsonOk({
      uploadedAt: date ? date.toISOString() : null,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
