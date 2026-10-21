import { readJsonBody } from "@/lib/server/request-body";
import { communitySettingsSchema, updateCommunitySettings } from "@/lib/server/community-settings";
import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { normalizeLink } from "@/lib/server/validation";
import { getContactsMap } from "@/lib/server/contacts";
import { getPrivacyDisplayName, getPrivacySettingsBatch } from "@/lib/server/privacy-settings";
import { getMediaUploadedAt } from "@/lib/server/media-meta";

type Params = {
  params: Promise<{ link: string }>;
};


async function resolveChannel(userId: string, link: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      link: string;
      name: string;
      reactionMode: string;
      allowedReactions: string[];
        description: string | null;
      avatarUrl: string | null;
      ownerId: string;
      subscribersCount: bigint | number;
      isSubscribed: boolean;
      createdAt: Date;
      updatedAt: Date;
      isPublic: boolean;
    }>
  >`
    SELECT
      c."id",
      c."link",
      c."name",
      c."reactionMode",
      c."allowedReactions",
      c."description",
      c."avatarUrl",
      c."ownerId",
      COUNT(cs_all."id") AS "subscribersCount",
      EXISTS(
        SELECT 1
        FROM "ChannelSubscriber" cs_me
        WHERE cs_me."channelId" = c."id" AND cs_me."userId" = ${userId}
      ) AS "isSubscribed",
      c."createdAt",
      c."updatedAt",
      c."isPublic"
    FROM "Channel" c
    LEFT JOIN "ChannelSubscriber" cs_all ON cs_all."channelId" = c."id"
    WHERE c."link" = ${link}
    GROUP BY c."id"
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;
    const link = normalizeLink(rawLink);

    const channel = await resolveChannel(user.id, link);
    if (!channel) {
      throw new HttpError(404, "Канал не найден");
    }
    if (!channel.isPublic && channel.ownerId !== user.id && !channel.isSubscribed) {
      throw new HttpError(403, "Этот канал доступен только подписчикам");
    }

    const isOwner = channel.ownerId === user.id;

    const subscribers = await prisma.$queryRaw<
      Array<{
        id: string;
        link: string;
        displayName: string;
        avatarUrl: string | null;
        role: string;
        roleLabel: string | null;
        canChangeAvatar: boolean;
        canChangeName: boolean;
        canChangeReactions: boolean;
        canPinMessages: boolean;
        canPostMessages: boolean;
        canEditForeignMessages: boolean;
        canDeleteForeignMessages: boolean;
        canAddMembers: boolean;
        canGenerateInviteLink: boolean;
        canManageAdmins: boolean;
      }>
    >`
      SELECT
        u."id",
        u."link",
        u."displayName",
        u."avatarUrl",
        cs."role",
        cs."roleLabel",
        cs."canChangeAvatar",
        cs."canChangeName",
        cs."canChangeReactions",
        cs."canPinMessages",
        cs."canPostMessages",
        cs."canEditForeignMessages",
        cs."canDeleteForeignMessages",
        cs."canAddMembers",
        cs."canGenerateInviteLink",
        cs."canManageAdmins"
      FROM "ChannelSubscriber" cs
      JOIN "User" u ON u."id" = cs."userId"
      WHERE cs."channelId" = ${channel.id}
      ORDER BY cs."createdAt" ASC
    `;

    const [contactsMap, memberPrivacyById, avatarUploadedAt] = await Promise.all([
      getContactsMap(user.id),
      getPrivacySettingsBatch(subscribers.map((member) => member.id)),
      isOwner ? getMediaUploadedAt(channel.avatarUrl) : null,
    ]);

    const members = subscribers.map((member) => {
      const contact = contactsMap.get(member.id);
      const privacy = memberPrivacyById.get(member.id);
      return {
        id: member.id,
        link: member.link,
        displayName:
          contact?.alias ||
          (privacy
            ? getPrivacyDisplayName(user.id, member.id, member.displayName, privacy)
            : member.displayName),
        avatarUrl: member.avatarUrl,
        role: member.role,
        roleLabel: member.roleLabel,
        canChangeAvatar: member.canChangeAvatar,
        canChangeName: member.canChangeName,
        canChangeReactions: member.canChangeReactions,
        canPinMessages: member.canPinMessages,
        canPostMessages: member.canPostMessages,
        canEditForeignMessages: member.canEditForeignMessages,
        canDeleteForeignMessages: member.canDeleteForeignMessages,
        canAddMembers: member.canAddMembers,
        canGenerateInviteLink: member.canGenerateInviteLink,
        canManageAdmins: member.canManageAdmins,
      };
    });

    // The authorized subscribers query already contains our role and permissions.
    const mySub = subscribers.find(member => member.id === user.id) ?? null;

    const res = jsonOk({
      channel: {
        id: channel.id,
        link: channel.link,
        name: channel.name,
          reactionMode: channel.reactionMode,
          allowedReactions: channel.allowedReactions,
          description: channel.description,
        avatarUrl: channel.avatarUrl ?? generateDefaultAvatarDataUrl(channel.name, channel.link),
        ownerId: channel.ownerId,
        isOwner,
        isSubscribed: channel.isSubscribed,
        myRole: isOwner ? "owner" : (mySub?.role ?? "member"),
        myRoleLabel: isOwner ? "создатель" : (mySub?.roleLabel ?? null),
        myCanChangeAvatar: isOwner ? true : (mySub?.canChangeAvatar ?? false),
        myCanChangeName: isOwner ? true : (mySub?.canChangeName ?? false),
        myCanChangeReactions: isOwner ? true : (mySub?.canChangeReactions ?? false),
        myCanPinMessages: isOwner ? true : (mySub?.canPinMessages ?? false),
        myCanPostMessages: isOwner ? true : (mySub?.canPostMessages ?? false),
        myCanEditForeignMessages: isOwner ? true : (mySub?.canEditForeignMessages ?? false),
        myCanDeleteForeignMessages: isOwner ? true : (mySub?.canDeleteForeignMessages ?? false),
        myCanAddMembers: isOwner ? true : (mySub?.canAddMembers ?? false),
        myCanGenerateInviteLink: isOwner ? true : (mySub?.canGenerateInviteLink ?? false),
        myCanManageAdmins: isOwner ? true : (mySub?.canManageAdmins ?? false),
        subscribersCount: String(Number(channel.subscribersCount)),
        isPublic: channel.isPublic,
        createdAt: channel.createdAt ? new Date(channel.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: channel.updatedAt ? new Date(channel.updatedAt).toISOString() : undefined,
        avatarUploadedAt: avatarUploadedAt?.toISOString() ?? null,
      },
      subscribers: members,
      members,
    });
    res.headers.set("Cache-Control", "private, no-store");
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const payload = communitySettingsSchema.parse(await readJsonBody(req, 4 * 1024 * 1024));
    const channel = await updateCommunitySettings("channel", user.id, normalizeLink(link), payload);
    const res = jsonOk({ channel });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;
    const link = normalizeLink(rawLink);

    const channel = await resolveChannel(user.id, link);
    if (!channel) {
      throw new HttpError(404, "Канал не найден");
    }
    if (channel.ownerId !== user.id) {
      throw new HttpError(403, "Только создатель может удалить канал");
    }

    await prisma.$executeRaw`
      DELETE FROM "Channel"
      WHERE "id" = ${channel.id}
    `;

    const res = jsonOk({ deleted: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
