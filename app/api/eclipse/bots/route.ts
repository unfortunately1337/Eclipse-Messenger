import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getBotManagementState, runBotManagement, type BotManagementInput } from "@/lib/server/bot-management";
import { sniffMediaBuffer, uploadMediaBuffer, deleteMediaObject } from "@/lib/server/media-storage";
import { prisma } from "@/lib/server/prisma";
import { readBotRequestBody } from "@/lib/server/bot-request-body";

const inputSchema = z.object({
  action: z.enum(["bots", "create", "mine", "back", "submit", "skip", "avatar", "select", "rotate", "revoke", "delete", "confirm_delete", "api_token", "settings", "change_avatar", "group_permissions", "change_name", "change_username"]),
  revision: z.number().int().min(0),
  requestId: z.string().uuid(),
  text: z.string().max(1000).optional(),
  botId: z.string().uuid().optional(),
}).strict();

function errorResponse(error: unknown) {
  const code = (error as { code?: string })?.code;
  const response = jsonError(code === "P2021" || code === "P2022" ? new HttpError(503, "Управление ботами временно недоступно. Попробуйте позже.") : error);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const response = jsonOk(await getBotManagementState(user.id));
    ensureCsrfCookie(req, response);
    return response;
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  let uploaded: { objectKey: string; bucket: string } | null = null;
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `bot-management:${user.id}`, limit: 40, windowSeconds: 60, message: "Слишком много действий. Подождите минуту." });
    const multipart = req.headers.get("content-type")?.startsWith("multipart/form-data");
    const bytes = await readBotRequestBody(req, multipart ? 5 * 1024 * 1024 + 16_384 : 4096);
    let input: BotManagementInput;
    if (multipart) {
      const form = await new Request(req.url, { method: "POST", headers: req.headers, body: bytes.buffer as ArrayBuffer }).formData();
      input = inputSchema.parse({ action: "avatar", revision: Number(form.get("revision")), requestId: form.get("requestId") });
      const state = await getBotManagementState(user.id);
      if (!["avatar", "avatar_edit"].includes(state.step) || state.revision !== input.revision) throw new HttpError(409, "Сначала выберите загрузку аватара в меню бота.");
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) throw new HttpError(400, "Выберите изображение до 5 МБ.");
      const buffer = Buffer.from(await file.arrayBuffer());
      const sniffed = sniffMediaBuffer(buffer, "image");
      const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      if (!sniffed || !extensions[sniffed.mimeType]) throw new HttpError(400, "Для аватара подойдут JPEG, PNG или WebP.");
      const digest = createHash("sha256").update(buffer).digest("hex");
      const objectKey = `bot-avatars/${user.id}/${input.requestId}-${digest}.${extensions[sniffed.mimeType]}`;
      uploaded = await uploadMediaBuffer({ buffer, size: file.size, mimeType: sniffed.mimeType, kind: "image", ownerId: user.id, objectKey });
      input.avatar = { objectKey: uploaded.objectKey, bucket: uploaded.bucket, mimeType: sniffed.mimeType, size: file.size };
    } else {
      const raw = new TextDecoder().decode(bytes);
      try { input = inputSchema.parse(JSON.parse(raw)); }
      catch (error) { if (error instanceof SyntaxError) throw new HttpError(400, "Некорректный запрос."); throw error; }
      if (input.action === "avatar") throw new HttpError(400, "Пришлите изображение.");
    }
    return jsonOk(await runBotManagement(user.id, input));
  } catch (error) { return errorResponse(error); }
  finally {
    if (uploaded) {
      const media = uploaded;
      const used = await prisma.mediaAsset.findFirst({ where: { objectKey: media.objectKey, bucket: media.bucket }, select: { id: true } }).catch(() => true);
      if (!used) await deleteMediaObject(media.bucket, media.objectKey).catch(() => {});
    }
  }
}
