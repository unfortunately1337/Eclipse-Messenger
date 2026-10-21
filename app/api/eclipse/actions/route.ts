import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { restrictAccountLoginsForSecurity } from "@/lib/server/account-security";
import {
  notifyEclipseSecurityRecommendation,
  sendEclipseSystemMessage,
} from "@/lib/server/eclipse-bot";
import { destroySessionById, listSessionsForUser } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { ECLIPSE_DIALOG_LINK, ECLIPSE_DIALOG_TITLE } from "@/lib/eclipse-system";
import type { EclipseMessageActionType, EclipseSystemPayload } from "@/lib/eclipse-system";

const schema = z.object({
  messageId: z.string().min(1),
  actionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId: currentSessionId } = await requireUserFromRequest(req);
    const body = schema.parse(await readJsonBody(req, 128 * 1024));

    const message = await prisma.message.findFirst({
      where: {
        id: body.messageId,
        isSystemMessage: true,
        conversation: {
          type: "eclipse",
          ownerUserId: user.id,
          isSystem: true,
        },
      },
      select: {
        id: true,
        systemPayload: true,
        senderId: true,
      },
    });

    if (!message?.systemPayload) {
      throw new HttpError(404, "Сообщение не найдено");
    }

    const payload = message.systemPayload as EclipseSystemPayload;
    const action = payload.actions?.find((item) => item.id === body.actionId);
    if (!action) {
      throw new HttpError(400, "Действие недоступно");
    }

    const actionType = action.action as EclipseMessageActionType;
    let handled = false;
    let redirectTo: string | undefined;

    if (actionType === "not_me") {
      const foreignSessionId = payload.metadata?.sessionId;
      if (foreignSessionId && foreignSessionId !== currentSessionId) {
        await destroySessionById(foreignSessionId);
      }
      await restrictAccountLoginsForSecurity(user.id);
      await notifyEclipseSecurityRecommendation(user.id);
      handled = true;
      redirectTo = "/app?settings=security&section=2fa";
    } else if (actionType === "terminate_sessions" || actionType === "terminate_other_sessions") {
      const sessions = await listSessionsForUser(user.id);
      await Promise.all(
        sessions
          .filter((item) => item.sessionId !== currentSessionId)
          .map((item) => destroySessionById(item.sessionId)),
      );
      await sendEclipseSystemMessage({
        userId: user.id,
        payload: {
          title: "Сессии завершены",
          body: `Дата и время: ${new Date().toLocaleString("ru-RU")}\n\nВсе другие активные сессии были завершены.`,
          eventType: "session_terminated",
        },
      });
      handled = true;
    } else if (actionType === "enable_2fa") {
      handled = true;
      redirectTo = "/app?settings=security&section=2fa";
    } else if (actionType === "change_password") {
      handled = true;
      redirectTo = "/app?settings=security&section=password";
    } else {
      throw new HttpError(400, "Неизвестное действие");
    }

    const updatedPayload: EclipseSystemPayload = {
      ...payload,
      actions: [],
    };

    await prisma.message.update({
      where: { id: message.id },
      data: { systemPayload: updatedPayload },
    });

    invalidateChatListPayloadCache(user.id);

    const { triggerRealtimeEvent, userPrivateChannel } = await import("@/lib/server/realtime");
    await triggerRealtimeEvent({
      channel: userPrivateChannel(user.id),
      name: "message:edited",
      data: {
        chatType: "eclipse",
        id: message.id,
        senderId: message.senderId,
        fromLink: ECLIPSE_DIALOG_LINK,
        fromDisplayName: ECLIPSE_DIALOG_TITLE,
        systemPayload: updatedPayload,
        createdAt: new Date().toISOString(),
      },
    }).catch(() => {});

    const res = jsonOk({
      handled,
      action: actionType,
      redirectTo,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
