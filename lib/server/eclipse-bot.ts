import { createHash, randomUUID } from "crypto";
import argon2 from "argon2";
import {
  ECLIPSE_DIALOG_LINK,
  ECLIPSE_DIALOG_TITLE,
  type EclipseEventType,
  type EclipseMessageAction,
  type EclipseMessageActionType,
  type EclipseSystemPayload,
} from "@/lib/eclipse-system";
import { prisma } from "@/lib/server/prisma";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";

export const ECLIPSE_DIALOG_TYPE = "eclipse";

export {
  ECLIPSE_DIALOG_LINK,
  ECLIPSE_DIALOG_TITLE,
};

function eclipseDialogLockKey(userId: string) {
  const digest = createHash("sha256").update(`eclipse:${userId}`).digest("hex").slice(0, 15);
  return BigInt(`0x${digest}`);
}

function deriveDeviceName(userAgent: string | null | undefined) {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "Неизвестное устройство";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows PC";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "Mac";
  if (ua.includes("linux")) return "Linux";
  return "Новое устройство";
}

function formatDateTime(value?: string | Date | null) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return "неизвестно";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionId(action: EclipseMessageActionType) {
  return `${action}-${randomUUID().slice(0, 8)}`;
}

function outlineAction(label: string, action: EclipseMessageActionType): EclipseMessageAction {
  return { id: actionId(action), label, action, variant: "outline" };
}

export async function ensureEclipseBotUser() {
  const existing = await prisma.user.findFirst({
    where: { link: ECLIPSE_DIALOG_LINK, isBot: true },
    select: { id: true, link: true, displayName: true, isBot: true, isVerified: true, isSystemAccount: true },
  });
  if (existing) {
    if (existing.displayName !== ECLIPSE_DIALOG_TITLE) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { displayName: ECLIPSE_DIALOG_TITLE },
        select: { id: true, link: true, displayName: true, isBot: true, isVerified: true, isSystemAccount: true },
      });
    }
    return existing;
  }

  const passwordHash = await argon2.hash(randomUUID(), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  return prisma.user.create({
    data: {
      link: ECLIPSE_DIALOG_LINK,
      displayName: ECLIPSE_DIALOG_TITLE,
      passwordHash,
      verified: true,
      isBot: true,
      isVerified: true,
      isSystemAccount: true,
    },
    select: { id: true, link: true, displayName: true, isBot: true, isVerified: true, isSystemAccount: true },
  });
}

export async function findEclipseDialog(userId: string) {
  return prisma.conversation.findFirst({
    where: {
      type: ECLIPSE_DIALOG_TYPE,
      ownerUserId: userId,
      isSystem: true,
      participants: { some: { userId } },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrCreateEclipseDialog(userId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${eclipseDialogLockKey(userId)}::bigint)`;
      } catch {
        // Ignore if advisory locks are restricted
      }

      const existing = await tx.conversation.findFirst({
        where: {
          type: ECLIPSE_DIALOG_TYPE,
          ownerUserId: userId,
          isSystem: true,
        },
        select: {
          id: true,
          participants: { select: { userId: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      if (existing) {
        if (!existing.participants.some((participant) => participant.userId === userId)) {
          await tx.conversationParticipant.create({
            data: { conversationId: existing.id, userId },
          });
        }
        return existing.id;
      }

      const created = await tx.conversation.create({
        data: {
          type: ECLIPSE_DIALOG_TYPE,
          ownerUserId: userId,
          title: ECLIPSE_DIALOG_TITLE,
          isSystem: true,
          participants: { create: [{ userId }] },
        },
        select: { id: true },
      });

      return created.id;
    });
  } catch (err) {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: ECLIPSE_DIALOG_TYPE,
        ownerUserId: userId,
      },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.conversation.create({
      data: {
        type: ECLIPSE_DIALOG_TYPE,
        ownerUserId: userId,
        title: ECLIPSE_DIALOG_TITLE,
        isSystem: true,
        participants: { create: [{ userId }] },
      },
      select: { id: true },
    });
    return created.id;
  }
}

export async function isEclipseBotUserId(userId: string) {
  const bot = await prisma.user.findFirst({
    where: { id: userId, isBot: true, isSystemAccount: true },
    select: { id: true },
  });
  return Boolean(bot);
}

export async function assertEclipseDialogForUser(userId: string, conversationId: string) {
  const dialog = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      type: ECLIPSE_DIALOG_TYPE,
      ownerUserId: userId,
      isSystem: true,
    },
    select: { id: true },
  });
  return Boolean(dialog);
}

type SendEclipseMessageInput = {
  userId: string;
  payload: EclipseSystemPayload;
};

export async function sendEclipseSystemMessage(input: SendEclipseMessageInput) {
  const [bot, conversationId] = await Promise.all([
    ensureEclipseBotUser(),
    getOrCreateEclipseDialog(input.userId),
  ]);

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: bot.id,
      isSystemMessage: true,
      systemPayload: input.payload,
      cipherText: null,
      iv: null,
      encryptedKeyForSender: null,
      encryptedKeyForRecipient: null,
    },
    select: {
      id: true,
      senderId: true,
      systemPayload: true,
      createdAt: true,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  invalidateChatListPayloadCache(input.userId);

  const systemPayload = message.systemPayload as EclipseSystemPayload;
  await triggerRealtimeEvent({
    channel: userPrivateChannel(input.userId),
    name: "message:new",
    data: {
      chatType: "eclipse",
      id: message.id,
      senderId: bot.id,
      fromLink: ECLIPSE_DIALOG_LINK,
      fromDisplayName: ECLIPSE_DIALOG_TITLE,
      systemPayload,
      createdAt: message.createdAt.toISOString(),
    },
  }).catch(() => {});

  return message;
}

export async function notifyEclipseNewLogin(input: {
  userId: string;
  sessionId: string;
  userAgent?: string | null;
  ip?: string | null;
  createdAt?: string;
}) {
  const deviceName = deriveDeviceName(input.userAgent);
  const occurredAt = input.createdAt ?? new Date().toISOString();
  const body = [
    `Дата и время: ${formatDateTime(occurredAt)}`,
    `Устройство: ${deviceName}`,
    input.ip ? `IP: ${input.ip}` : "IP: неизвестен",
    "",
    "Мы заметили новый вход в ваш аккаунт Eclipse.",
    "Если это были вы, ничего делать не нужно.",
    "",
    "Если вход выглядит подозрительно, завершите другие сессии, смените пароль и включите 2FA.",
  ].join("\n");

  return sendEclipseSystemMessage({
    userId: input.userId,
    payload: {
      title: "Новый вход",
      body,
      eventType: "new_login",
      metadata: {
        sessionId: input.sessionId,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        occurredAt,
      },
      actions: [
        outlineAction("Завершить все сессии", "terminate_sessions"),
        outlineAction("Включить 2FA", "enable_2fa"),
        outlineAction("Сменить пароль", "change_password"),
      ],
    },
  });
}

export async function notifyEclipseSecurityRecommendation(userId: string) {
  return sendEclipseSystemMessage({
    userId,
    payload: {
      title: "Рекомендации по безопасности",
      body: [
        "Мы подготовили быстрые действия для защиты аккаунта.",
        "",
        "Что лучше сделать:",
        "• завершить лишние активные сессии;",
        "• сменить пароль, если есть сомнения;",
        "• включить 2FA, чтобы вход требовал дополнительный код.",
        "",
        "Эти действия не удаляют ваши чаты и данные.",
      ].join("\n"),
      eventType: "security_recommendation",
      actions: [
        outlineAction("Завершить другие сессии", "terminate_other_sessions"),
        outlineAction("Сменить пароль", "change_password"),
        outlineAction("Включить 2FA", "enable_2fa"),
      ],
    },
  });
}

export async function notifyEclipsePasswordChanged(userId: string) {
  return sendEclipseSystemMessage({
    userId,
    payload: {
      title: "Пароль изменён",
      body: [
        `Дата и время: ${formatDateTime(new Date())}`,
        "",
        "Пароль от аккаунта был успешно изменён.",
        "Если это сделали вы, аккаунт уже использует новый пароль.",
        "",
        "Если вы не меняли пароль, завершите другие сессии и включите 2FA.",
      ].join("\n"),
      eventType: "password_changed",
      actions: [
        outlineAction("Завершить все сессии", "terminate_sessions"),
        outlineAction("Включить 2FA", "enable_2fa"),
      ],
    },
  });
}

export async function notifyEclipseTwoFactorEnabled(userId: string) {
  return sendEclipseSystemMessage({
    userId,
    payload: {
      title: "2FA включена",
      body: [
        `Дата и время: ${formatDateTime(new Date())}`,
        "",
        "Двухфакторная защита активна.",
        "Теперь при входе в аккаунт потребуется код из приложения-аутентификатора.",
        "",
        "Это сильно снижает риск входа без вашего разрешения.",
      ].join("\n"),
      eventType: "two_factor_enabled",
    },
  });
}

export async function notifyEclipseTwoFactorDisabled(userId: string) {
  return sendEclipseSystemMessage({
    userId,
    payload: {
      title: "2FA отключена",
      body: [
        `Дата и время: ${formatDateTime(new Date())}`,
        "",
        "Двухфакторная защита была отключена.",
        "Теперь для входа достаточно пароля.",
        "",
        "Если это сделали не вы, включите 2FA обратно и смените пароль.",
      ].join("\n"),
      eventType: "two_factor_disabled",
      actions: [
        outlineAction("Включить 2FA", "enable_2fa"),
        outlineAction("Сменить пароль", "change_password"),
      ],
    },
  });
}

export async function notifyEclipseSuspiciousActivity(userId: string, details?: string) {
  return sendEclipseSystemMessage({
    userId,
    payload: {
      title: "Подозрительная активность",
      body: details ?? [
        `Дата и время: ${formatDateTime(new Date())}`,
        "",
        "Мы заметили действие, похожее на рискованное.",
        "Для защиты аккаунта входы могут быть временно ограничены на 24 часа.",
        "",
        "Проверьте активные сессии и включите 2FA, если она ещё не включена.",
      ].join("\n"),
      eventType: "suspicious_activity",
      actions: [
        outlineAction("Завершить все сессии", "terminate_sessions"),
        outlineAction("Включить 2FA", "enable_2fa"),
      ],
    },
  });
}

export async function notifyEclipseSessionTerminated(userId: string, deviceName?: string) {
  return sendEclipseSystemMessage({
    userId,
    payload: {
      title: "Сессия завершена",
      body: [
        `Дата и время: ${formatDateTime(new Date())}`,
        "",
        deviceName ? `Устройство: ${deviceName}` : "Одна из активных сессий была завершена.",
        "",
        "Если это действие было вашим, ничего делать не нужно.",
      ].join("\n"),
      eventType: "session_terminated",
    },
  });
}

export function buildEclipseEventTypeLabel(eventType: EclipseEventType) {
  switch (eventType) {
    case "new_login":
      return "Новый вход";
    case "password_changed":
      return "Пароль изменён";
    case "two_factor_enabled":
      return "2FA включена";
    case "two_factor_disabled":
      return "2FA отключена";
    case "suspicious_activity":
      return "Подозрительная активность";
    case "session_terminated":
      return "Сессия завершена";
    case "security_recommendation":
      return "Безопасность";
    default:
      return "Уведомление";
  }
}
