import { prisma } from "./prisma";
import { HttpError } from "./http";
import { normalizeLink } from "./validation";

export const communityPermissions = ["canChangeAvatar", "canChangeName", "canChangeReactions", "canPinMessages", "canDeleteForeignMessages", "canAddMembers", "canPostMessages", "canGenerateInviteLink", "canManageAdmins", "canEditForeignMessages"] as const;
type Permissions = Partial<Record<typeof communityPermissions[number], boolean>>;
type Member = Permissions & { userId: string; role: string };
export type RolePatch = Permissions & { memberId: string; role?: "member" | "admin"; roleLabel?: string };

export function assertRoleDelegation(ownerId: string, requester: Member | null, target: Member | null, userId: string, payload: RolePatch) {
  const owner = ownerId === userId;
  if (!owner && !(requester?.role === "admin" && requester.canManageAdmins)) throw new HttpError(403, "Недостаточно прав для настройки прав участников");
  if (payload.memberId === ownerId) throw new HttpError(400, "Нельзя изменить роль владельца");
  if (!target) throw new HttpError(404, "Участник не найден");
  if (owner) return;
  if (payload.memberId === userId) throw new HttpError(403, "Нельзя изменять собственные права");
  if (communityPermissions.some(key => (payload[key] || (target.role === "admin" && target[key])) && !requester?.[key])) {
    throw new HttpError(403, "Нельзя управлять правами, которых у вас нет");
  }
}

export async function updateCommunityRole(kind: "group" | "channel", userId: string, rawLink: string, payload: RolePatch) {
  return prisma.$transaction(async tx => {
    const link = normalizeLink(rawLink);
    const entity = kind === "group" ? await tx.group.findUnique({ where: { link } }) : await tx.channel.findUnique({ where: { link } });
    if (!entity) throw new HttpError(404, "Чат не найден");
    // Lock both rows in a stable order: a concurrent revocation cannot race this write.
    const rows = kind === "group"
      ? await tx.$queryRaw<Member[]>`SELECT * FROM "GroupMember" WHERE "groupId" = ${entity.id} AND "userId" IN (${userId}, ${payload.memberId}) ORDER BY "userId" FOR UPDATE`
      : await tx.$queryRaw<Member[]>`SELECT * FROM "ChannelSubscriber" WHERE "channelId" = ${entity.id} AND "userId" IN (${userId}, ${payload.memberId}) ORDER BY "userId" FOR UPDATE`;
    assertRoleDelegation(entity.ownerId, rows.find(row => row.userId === userId) ?? null, rows.find(row => row.userId === payload.memberId) ?? null, userId, payload);
    const role = payload.role ?? "admin";
    const roleLabel = payload.roleLabel?.trim() || (role === "admin" ? "админ" : null);
    const data = { role, roleLabel, ...Object.fromEntries(communityPermissions.filter(key => kind === "channel" || key !== "canEditForeignMessages").map(key => [key, Boolean(payload[key])])) };
    if (kind === "group") await tx.groupMember.update({ where: { groupId_userId: { groupId: entity.id, userId: payload.memberId } }, data });
    else await tx.channelSubscriber.update({ where: { channelId_userId: { channelId: entity.id, userId: payload.memberId } }, data });
    return { ...entity, role, roleLabel, canChangeReactions: Boolean(payload.canChangeReactions), canPinMessages: Boolean(payload.canPinMessages) };
  });
}
