import fs from "node:fs/promises";
import path from "node:path";
import { artworkFallbackResponse } from "@/lib/server/artwork-fallback";
import { NextRequest, NextResponse } from "next/server";
import { loadEmojiGif, emojiMirrorUrls } from "@/lib/server/emoji-assets";
import { TELEGRAM_EMOJI_GIF_MAP } from "@/lib/client/telegram-emoji-gifs";

const VALID_GIFS = new Set(Object.values(TELEGRAM_EMOJI_GIF_MAP));
VALID_GIFS.add("guy-with-laptop-2.gif");

const CACHE_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "public, max-age=31536000, immutable, stale-while-revalidate=86400",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    if (!filename || !filename.endsWith(".gif") || !VALID_GIFS.has(filename)) {
      return new NextResponse("Invalid emoji gif", { status: 404 });
    }

    const bundled = await fs.stat(path.join(process.cwd(), "public", "gifs", filename)).then(stat => stat.isFile()).catch(() => false);
    if (!bundled) return artworkFallbackResponse(`/gifs/${filename}`);

    const ifNoneMatch = req.headers.get("if-none-match");
    const etag = `"${filename}"`;
    if (ifNoneMatch && ifNoneMatch.split(",").some(value => value.trim() === etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...CACHE_HEADERS,
          ETag: etag,
        },
      });
    }

    let responseBuffer: Buffer;
    try {
      responseBuffer = await loadEmojiGif(filename);
    } catch {
      return NextResponse.redirect(emojiMirrorUrls(filename)[0]!, 302);
    }

    return new NextResponse(new Uint8Array(responseBuffer), {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        "Content-Length": String(responseBuffer.length),
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("Error serving emoji gif:", err);
    return new NextResponse("Error serving emoji gif", { status: 500 });
  }
}
