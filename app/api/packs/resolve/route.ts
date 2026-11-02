import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { jsonOk, jsonError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { packItemView, packItemMetadataSelect } from "@/lib/server/pack-library";
export async function GET(req: NextRequest) {
  try {
    await requireUserFromRequest(req);
    const ids = z.array(z.string().regex(/^tg-[a-f0-9]{24}$/)).min(1).max(100).parse(req.nextUrl.searchParams.get("ids")?.split(","));
    const items = await prisma.importedPackItem.findMany({ where: { id: { in: [...new Set(ids)] }, published: true, pack: { ready: true } }, select: { ...packItemMetadataSelect, pack: { select: { title: true, kind: true } } } });
    return jsonOk({ items: items.map(item => ({ ...packItemView(item), title: item.pack.title, kind: item.pack.kind })) });
  } catch (error) { return jsonError(error); }
}
