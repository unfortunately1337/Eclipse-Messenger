import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { HttpError, jsonOk, jsonError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { resolveUploadScope } from "@/lib/server/media-scope";

const schema = z.object({ url: z.string().startsWith("/media/").max(2048), scopeType: z.enum(["direct", "conversation", "group", "channel", "saved", "secret"]), scopeId: z.string().min(1).max(128) });

// Only the uploader can migrate a legacy URL, after decrypting their own history.
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    const input = schema.parse(await readJsonBody(req, 128 * 1024));
    const key = input.url.slice(7).split(/[?#]/)[0];
    const asset = await prisma.mediaAsset.findFirst({ where: { ownerId: user.id, objectKey: { in: [key, key.startsWith("media/") ? key.slice(6) : `media/${key}`] } } });
    if (!asset) throw new HttpError(404, "Файл не найден");
    const scope = await resolveUploadScope(input.scopeType, input.scopeId, user.id, sessionId);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "MediaAsset" WHERE "id" = ${asset.id} FOR UPDATE`;
      const current = await tx.mediaAsset.findUnique({ where: { id: asset.id } });
      if (!current || current.status !== "ready") throw new HttpError(404, "Файл недоступен");
      if (current.scopeType !== "legacy" && current.scopeType !== "public") {
        if (current.scopeType !== scope.scopeType || current.scopeId !== scope.scopeId) throw new HttpError(409, "Вложение уже принадлежит другому чату");
        return;
      }
      if (scope.scopeType === "secret") {
        // Secret attachments must have one lifetime and may not be shared with other chats.
        if (await tx.mediaAssetAccess.count({ where: { mediaAssetId: asset.id } })) throw new HttpError(409, "Для секретного чата загрузите файл заново");
        await tx.mediaAsset.update({ where: { id: asset.id }, data: scope });
      } else {
        await tx.mediaAssetAccess.upsert({
          where: { mediaAssetId_scopeType_scopeId: { mediaAssetId: asset.id, scopeType: scope.scopeType, scopeId: scope.scopeId! } },
          create: { mediaAssetId: asset.id, scopeType: scope.scopeType, scopeId: scope.scopeId! }, update: {},
        });
      }
    });
    return jsonOk({ restored: true });
  } catch (error) { return jsonError(error); }
}
