import { createHash } from "crypto";
import { prisma } from "@/lib/server/prisma";

export const SAVED_DIALOG_TYPE = "saved";
export const SAVED_DIALOG_LINK = "saved";
export const SAVED_DIALOG_TITLE = "Избранное";

export {
  ECLIPSE_DIALOG_TYPE,
  ECLIPSE_DIALOG_LINK,
  ECLIPSE_DIALOG_TITLE,
  findEclipseDialog,
  getOrCreateEclipseDialog,
  isEclipseBotUserId,
} from "@/lib/server/eclipse-bot";

async function ensureConversationSchema() {
  // Schema changes must be applied by migrations, not at request time.
  return;
}

function directPairLockKey(userId: string, peerId: string) {
  const [a, b] = [userId, peerId].sort();
  const digest = createHash("sha256").update(`${a}:${b}`).digest("hex").slice(0, 15);
  return BigInt(`0x${digest}`);
}

function savedDialogLockKey(userId: string) {
  const digest = createHash("sha256").update(`saved:${userId}`).digest("hex").slice(0, 15);
  return BigInt(`0x${digest}`);
}

export async function getOrCreateDirectConversation(userId: string, peerId: string) {
  // Fast path: check existing conversation first without transaction or advisory locks
  const existingId = await findDirectConversation(userId, peerId);
  if (existingId) {
    return existingId;
  }

  await ensureConversationSchema();

  return prisma.$transaction(async (tx) => {
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${directPairLockKey(userId, peerId)}::bigint)`;
    } catch {
      // Ignore if advisory locks are restricted
    }

    const existing = await tx.conversation.findFirst({
      where: {
        type: "direct",
        AND: [
          {
            participants: {
              every: {
                userId: { in: [userId, peerId] },
              },
            },
          },
          {
            participants: {
              some: { userId },
            },
          },
          {
            participants: {
              some: { userId: peerId },
            },
          },
        ],
      },
      select: {
        id: true,
        participants: {
          select: { userId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing && existing.participants.length === 2) {
      return existing.id;
    }

    const created = await tx.conversation.create({
      data: {
        type: "direct",
        participants: {
          create: [{ userId }, { userId: peerId }],
        },
      },
      select: { id: true },
    });

    return created.id;
  });
}

export async function findDirectConversation(userId: string, peerId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c."id"
      FROM "Conversation" c
      JOIN "ConversationParticipant" cp1 ON cp1."conversationId" = c."id" AND cp1."userId" = ${userId}
      JOIN "ConversationParticipant" cp2 ON cp2."conversationId" = c."id" AND cp2."userId" = ${peerId}
      WHERE c."type" = 'direct'
        AND (
          SELECT COUNT(*)::int
          FROM "ConversationParticipant" cp
          WHERE cp."conversationId" = c."id"
        ) = 2
      ORDER BY c."updatedAt" DESC
      LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }
  } catch {
    // fallback to prisma query below
  }

  await ensureConversationSchema();

  const existing = await prisma.conversation.findFirst({
    where: {
      type: "direct",
      AND: [
        {
          participants: {
            every: {
              userId: { in: [userId, peerId] },
            },
          },
        },
        {
          participants: {
            some: { userId },
          },
        },
        {
          participants: {
            some: { userId: peerId },
          },
        },
      ],
    },
    select: {
      id: true,
      participants: {
        select: { userId: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing && existing.participants.length === 2) {
    return existing.id;
  }

  return null;
}

export async function findSavedDialog(userId: string) {
  await ensureConversationSchema();

  return prisma.conversation.findFirst({
    where: {
      type: SAVED_DIALOG_TYPE,
      ownerUserId: userId,
      isSystem: true,
      participants: {
        some: { userId },
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrCreateSavedDialog(userId: string) {
  await ensureConversationSchema();

  try {
    return await prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${savedDialogLockKey(userId)}::bigint)`;
      } catch {
        // Ignore if advisory locks are restricted
      }

      const existing = await tx.conversation.findFirst({
        where: {
          type: SAVED_DIALOG_TYPE,
          ownerUserId: userId,
          isSystem: true,
        },
        select: {
          id: true,
          participants: {
            select: { userId: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      if (existing) {
        if (!existing.participants.some((participant) => participant.userId === userId)) {
          await tx.conversationParticipant.create({
            data: {
              conversationId: existing.id,
              userId,
            },
          });
        }
        return existing.id;
      }

      const created = await tx.conversation.create({
        data: {
          type: SAVED_DIALOG_TYPE,
          ownerUserId: userId,
          title: SAVED_DIALOG_TITLE,
          isSystem: true,
          participants: {
            create: [{ userId }],
          },
        },
        select: { id: true },
      });

      return created.id;
    });
  } catch (err) {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: SAVED_DIALOG_TYPE,
        ownerUserId: userId,
      },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.conversation.create({
      data: {
        type: SAVED_DIALOG_TYPE,
        ownerUserId: userId,
        title: SAVED_DIALOG_TITLE,
        isSystem: true,
        participants: {
          create: [{ userId }],
        },
      },
      select: { id: true },
    });
    return created.id;
  }
}
