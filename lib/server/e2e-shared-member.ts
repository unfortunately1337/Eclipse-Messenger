import { prisma } from "@/lib/server/prisma";

export async function revokeGroupSharedKeysForMember(groupId: string, userId: string) {
  await prisma.groupE2EKeyMember.deleteMany({
    where: {
      userId,
      groupKey: { groupId },
    },
  });
}

export async function revokeChannelSharedKeysForMember(channelId: string, userId: string) {
  await prisma.channelE2EKeyMember.deleteMany({
    where: {
      userId,
      channelKey: { channelId },
    },
  });
}

export function publicEncryptedMessageText(
  text: string | null | undefined,
  cipherText: string | null | undefined,
) {
  if (cipherText) return null;
  return text ?? null;
}
