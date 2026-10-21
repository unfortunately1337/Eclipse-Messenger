import { NextRequest } from "next/server";
import { requireMediaAccess } from "@/lib/server/media-access";
import { getMediaObjectStream, MediaRangeNotSatisfiableError } from "@/lib/server/media-storage";
import { getMediaStorageConfig } from "@/lib/server/media-config";

function normalizeUploadTail(path: string[]) {
  const keyTail = Array.isArray(path) ? path.join("/") : "";
  if (
    !keyTail ||
    keyTail.includes("\\") ||
    keyTail.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    return null;
  }
  return keyTail;
}

function mediaHeaders(headers: Headers, contentType: string, objectKey: string) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox");
  if (!/^(image|video|audio)\//i.test(contentType)) {
    const filename = objectKey.split("/").pop()?.replace(/["\r\n]/g, "") || "download";
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const keyTail = normalizeUploadTail(path);
    if (!keyTail) {
      return new Response("Not found", { status: 404 });
    }

    const config = getMediaStorageConfig();
    const objectKey = `uploads/${keyTail}`;
    await requireMediaAccess(req, objectKey);
    const rangeHeader = req.headers.get("range");
    const { body, contentType, contentLength, etag, contentRange, acceptRanges, statusCode } =
      await getMediaObjectStream(config.bucket, objectKey, rangeHeader);

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", acceptRanges);
    if (contentLength) headers.set("Content-Length", String(contentLength));
    if (contentRange) headers.set("Content-Range", contentRange);
    if (etag) headers.set("ETag", etag);
    headers.set("Cache-Control", "private, no-store");
    mediaHeaders(headers, contentType, objectKey);

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
