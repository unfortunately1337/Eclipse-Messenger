import "server-only";
import { HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export type InvitePreview = {
  type: "group" | "channel";
  link: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  count: number;
};

export function inviteToken(value: string) {
  const token = value.trim();
  if (!/^[a-f0-9]{32,48}$/.test(token)) throw new HttpError(404, "Ссылка приглашения недействительна");
  return token;
}

// Shared by the server-rendered page and the API. Previewing never joins a
// community, consumes an invite use, or exposes participants/private messages.
export async function getInvitePreview(value: string): Promise<InvitePreview> {
  const token = inviteToken(value);
  const invite = await prisma.inviteLink.findUnique({
    where: { token },
    select: { type: true, groupId: true, channelId: true, revokedAt: true, expiresAt: true },
  });
  if (!invite || invite.revokedAt || (invite.expiresAt && invite.expiresAt.getTime() <= Date.now())) {
    throw new HttpError(404, "Ссылка приглашения недействительна или срок её действия истёк");
  }
  let preview: InvitePreview | undefined;
  if (invite.type === "group" && invite.groupId) {
    const group = await prisma.group.findUnique({
      where: { id: invite.groupId },
      select: { link: true, name: true, description: true, avatarUrl: true, _count: { select: { members: true } } },
    });
    if (group) preview = { type: "group", link: group.link, name: group.name, description: group.description, avatarUrl: group.avatarUrl, count: group._count.members };
  } else if (invite.type === "channel" && invite.channelId) {
    const channel = await prisma.channel.findUnique({
      where: { id: invite.channelId },
      select: { link: true, name: true, description: true, avatarUrl: true, _count: { select: { subscribers: true } } },
    });
    if (channel) preview = { type: "channel", link: channel.link, name: channel.name, description: channel.description, avatarUrl: channel.avatarUrl, count: channel._count.subscribers };
  }
  if (!preview) throw new HttpError(404, "Ссылка приглашения недействительна");
  return preview;
}
