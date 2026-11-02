import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { HttpError, jsonOk, jsonError } from "@/lib/server/http";
import { readJsonBody } from "@/lib/server/request-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/server/prisma";
import { packView, packMetadataSelect, packItemMetadataSelect } from "@/lib/server/pack-library";
type Params = { params: Promise<{ id: string }> };
const idSchema = z.string().regex(/^pack-[a-f0-9]{24}$/);
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const id = idSchema.parse((await params).id);
    const [pack, member] = await Promise.all([
      prisma.importedPack.findUnique({ where: { id }, select: { ...packMetadataSelect, items: { where: { published: true }, orderBy: { ordinal: "asc" }, select: packItemMetadataSelect } } }),
      prisma.userImportedPack.findUnique({ where: { userId_packId: { userId: user.id, packId: id } }, select: { packId: true } }),
    ]);
    if (!pack) throw new HttpError(404, "Набор не найден.");
    return jsonOk({ pack: packView(pack, Boolean(member)) });
  } catch (error) { return jsonError(error); }
}
export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req); const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `packs:library:${user.id}`, limit: 60, windowSeconds: 60 });
    const id = idSchema.parse((await params).id);
    const { action } = z.object({ action: z.enum(["add", "remove"]) }).strict().parse(await readJsonBody(req, 1024));
    const pack = await prisma.importedPack.findUnique({ where: { id }, select: { ready: true } });
    if (!pack?.ready) throw new HttpError(409, "Дождитесь завершения импорта.");
    if (action === "add") {
      await prisma.$transaction(async db => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pack-library:${user.id}`}, 0))`;
        const existing = await db.userImportedPack.findUnique({ where: { userId_packId: { userId: user.id, packId: id } } });
        if (!existing && await db.userImportedPack.count({ where: { userId: user.id } }) >= 200) throw new HttpError(400, "Можно добавить до 200 наборов.");
        await db.userImportedPack.upsert({ where: { userId_packId: { userId: user.id, packId: id } }, update: {}, create: { userId: user.id, packId: id } });
      });
    } else {
      // Keep immutable artwork for messages and statuses already sent to other people.
      await prisma.userImportedPack.deleteMany({ where: { userId: user.id, packId: id } });
    }
    return jsonOk({ installed: action === "add" });
  } catch (error) { return jsonError(error); }
}
