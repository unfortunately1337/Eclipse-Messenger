import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";

export async function withSharedMessageEdit<T>(kind: "group" | "channel", id: string, actorId: string, authorId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}-e2e:${id}`}))`;
    if (kind === "group") {
      const member = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: actorId } }, select: { id: true } });
      if (!member || actorId !== authorId) throw new HttpError(403, "Нет права редактировать сообщение");
    } else {
      const channel = await tx.channel.findUnique({ where: { id }, select: { ownerId: true } });
      const member = await tx.channelSubscriber.findUnique({ where: { channelId_userId: { channelId: id, userId: actorId } } });
      if (channel?.ownerId !== actorId && !(member?.role === "admin" && (member.canEditForeignMessages || (actorId === authorId && member.canPostMessages)))) throw new HttpError(403, "Нет права редактировать публикацию");
    }
    return write(tx);
  });
}
