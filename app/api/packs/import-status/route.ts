import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import type { EclipseSystemPayload } from "@/lib/eclipse-system";
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const id = req.nextUrl.searchParams.get("messageId");
    if (!id || id.length > 128) throw new HttpError(400, "Некорректное сообщение.");
    const message = await prisma.message.findFirst({ where: { id, senderId: "system:importbot", conversation: { participants: { some: { userId: user.id } } } }, select: { systemPayload: true } });
    const card = (message?.systemPayload as EclipseSystemPayload | null)?.metadata?.packImport;
    if (!card) throw new HttpError(404, "Импорт не найден.");
    return jsonOk({ card });
  } catch (error) { return jsonError(error); }
}
