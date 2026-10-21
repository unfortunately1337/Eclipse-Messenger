import { NextRequest } from "next/server";
import { requireMediaAccess } from "@/lib/server/media-access";
import { getMediaObjectStream, MediaRangeNotSatisfiableError } from "@/lib/server/media-storage";
import { getMediaStorageConfig } from "@/lib/server/media-config";
import { getMediaUploadedAt } from "@/lib/server/media-meta";
import { getSessionFromRequest } from "@/lib/server/session";

function normalizeObjectKey(path: string[]) {
  const objectKey = Array.isArray(path) ? path.join("/") : "";
  if (
    !objectKey ||
    objectKey.includes("\\") ||
    objectKey.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    return null;
  }
  return objectKey;
}

function mediaHeaders(headers: Headers, contentType: string, objectKey: string) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Vary", "Cookie");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  if (!/^(image|video|audio)\//i.test(contentType)) {
    const filename = objectKey.split("/").pop()?.replace(/["\r\n]/g, "") || "download";
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  } else {
    headers.set("Content-Disposition", "inline");
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const objectKey = normalizeObjectKey(path);
    if (!objectKey) {
      return new Response("Not found", { status: 404 });
    }
    const asset = await requireMediaAccess(req, objectKey);

    let bucket = "eclpse";
    try {
      bucket = getMediaStorageConfig().bucket;
    } catch {}

    const rangeHeader = req.headers.get("range");
    const { body, contentType, contentLength, etag, contentRange, acceptRanges, statusCode } =
      await getMediaObjectStream(bucket, objectKey, rangeHeader);

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", acceptRanges);
    if (contentLength) headers.set("Content-Length", String(contentLength));
    if (contentRange) headers.set("Content-Range", contentRange);
    if (etag) headers.set("ETag", etag);
    headers.set("Cache-Control", "private, no-store");
    mediaHeaders(headers, contentType, objectKey);

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && etag && (ifNoneMatch === etag || ifNoneMatch === `"${etag}"` || ifNoneMatch === `W/"${etag}"` || ifNoneMatch.includes(etag))) {
      return new Response(null, { status: 304, headers });
    }

    const session = await getSessionFromRequest(req).catch(() => null);
    const uploadedAt = asset.ownerId === session?.data.userId ? await getMediaUploadedAt(objectKey) : null;
    if (uploadedAt) {
      headers.set("Last-Modified", uploadedAt.toUTCString());
      headers.set("X-Uploaded-At", uploadedAt.toISOString());
    }
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Type, Accept-Ranges, Content-Range, ETag");

    return new Response(body as unknown as BodyInit, { status: statusCode, headers });
  } catch (error) {
    if (error instanceof MediaRangeNotSatisfiableError) {
      const headers = new Headers();
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Range", `bytes */${Math.max(0, error.totalLength ?? 0)}`);
      return new Response(null, { status: 416, headers });
    }
    return new Response("Not found", { status: 404 });
  }
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const objectKey = normalizeObjectKey(path);
    if (!objectKey) {
      return new Response(null, { status: 404 });
    }
    const asset = await requireMediaAccess(req, objectKey);

    let bucket = "eclpse";
    try {
      bucket = getMediaStorageConfig().bucket;
    } catch {}

    const { contentType, contentLength, etag, acceptRanges, statusCode } =
      await getMediaObjectStream(bucket, objectKey);

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", acceptRanges);
    if (contentLength) headers.set("Content-Length", String(contentLength));
    if (etag) headers.set("ETag", etag);
    headers.set("Cache-Control", "private, no-store");
    mediaHeaders(headers, contentType, objectKey);
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && etag && (ifNoneMatch === etag || ifNoneMatch === `"${etag}"` || ifNoneMatch === `W/"${etag}"` || ifNoneMatch.includes(etag))) {
      return new Response(null, { status: 304, headers });
    }

    const session = await getSessionFromRequest(req).catch(() => null);
    const uploadedAt = asset.ownerId === session?.data.userId ? await getMediaUploadedAt(objectKey) : null;
    if (uploadedAt) {
      headers.set("Last-Modified", uploadedAt.toUTCString());
      headers.set("X-Uploaded-At", uploadedAt.toISOString());
    }
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Type, Accept-Ranges, Content-Range, ETag");

    return new Response(null, { status: statusCode, headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Accept-Ranges, Content-Type, Authorization, If-Range, If-None-Match",
      "Access-Control-Max-Age": "86400",
    },
  });
}
