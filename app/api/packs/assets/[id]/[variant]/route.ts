import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getMediaObjectStream } from "@/lib/server/media-storage";
import { HttpError, jsonError } from "@/lib/server/http";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; variant: string }> }) {
  try {
    await requireUserFromRequest(req);
    const { id, variant } = await params;
    if (!/^tg-[a-f0-9]{24}$/.test(id) || !["original", "thumbnail"].includes(variant)) throw new HttpError(404, "Файл не найден.");
    const item = await prisma.importedPackItem.findUnique({ where: { id } });
    if (!item?.published) throw new HttpError(404, "Файл не найден.");
    const media = await getMediaObjectStream(item.bucket, variant === "thumbnail" ? item.thumbnailKey : item.objectKey, req.headers.get("range"));
    const headers = new Headers({ "Content-Type": media.contentType, "Cache-Control": "private, max-age=86400, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" });
    if (media.contentLength != null) headers.set("Content-Length", String(media.contentLength));
    if (media.contentRange) headers.set("Content-Range", media.contentRange);
    headers.set("Accept-Ranges", "bytes");
    return new Response(media.body as ReadableStream<Uint8Array>, { status: media.statusCode ?? 200, headers });
  } catch (error) { return jsonError(error); }
}
