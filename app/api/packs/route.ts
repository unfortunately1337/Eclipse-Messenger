import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { jsonOk, jsonError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { packView, packMetadataSelect, packItemMetadataSelect } from "@/lib/server/pack-library";
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const memberships = await prisma.userImportedPack.findMany({ where: { userId: user.id, pack: { ready: true } }, orderBy: { createdAt: "asc" }, take: 200,
      select: { pack: { select: { ...packMetadataSelect, items: { where: { published: true }, orderBy: { ordinal: "asc" }, take: 1, select: packItemMetadataSelect } } } } });
    return jsonOk({ packs: memberships.map(member => packView(member.pack, true)) });
  } catch (error) { return jsonError(error); }
}
