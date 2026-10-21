import { artworkFallbackResponse } from "@/lib/server/artwork-fallback";

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  return artworkFallbackResponse(`/emoji-picker/${asset.join("/")}`);
}
