import { requestSharedHistoryKeys, notifySharedKeysReady } from "@/lib/server/shared-key-notifications";
import { readRequestBody } from "@/lib/server/request-body";
import { wrappedMessageKeySchema } from "@/lib/server/message-envelope";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { normalizeLink } from "@/lib/server/validation";
import { decryptE2ESecretFromDb, encryptE2ESecretForDb } from "@/lib/server/e2e-storage";
import { getUserPublicKeys } from "@/lib/server/e2e-key";

type Params = {
  params: Promise<{ link: string }>;
};

const rotateSchema = z.object({
  version: z.number().int().min(1),
  keys: z
    .array(
      z.object({
        userId: z.string().min(1),
        encryptedKey: wrappedMessageKeySchema,
      }),
    )
    .min(1)
    .max(1000),
});

function isLifecycleColumnMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code !== "P2022" && code !== "P2010") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes("status") || message.includes("algorithm");
}

async function resolveGroupMembership(userId: string, rawLink: string) {
  const link = normalizeLink(rawLink);
  const rows = await prisma.$queryRaw<
    Array<{ id: string; link: string; ownerId: string; myRole: string }>
  >`
    SELECT g."id", g."link", g."ownerId", gm."role" AS "myRole"
    FROM "Group" g
    JOIN "GroupMember" gm ON gm."groupId" = g."id"
    WHERE g."link" = ${link} AND gm."userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const group = await resolveGroupMembership(user.id, link);
    if (!group) {
      throw new HttpError(403, "Вы не состоите в этой группе");
    }

    const includeMembers = req.nextUrl.searchParams.get("includeMembers") === "1";
    const versionParam = req.nextUrl.searchParams.get("version");
    const requestedVersionRaw = versionParam ? Number.parseInt(versionParam, 10) : null;
    const requestedVersion = Number.isFinite(requestedVersionRaw) ? requestedVersionRaw : null;
    let latestKey: { id: string; version: number } | null = null;
    try {
      latestKey = await prisma.groupE2EKey.findFirst({
        where: { groupId: group.id, status: "active" },
        orderBy: { version: "desc" },
        select: { id: true, version: true },
      });
    } catch (error) {
      if (!isLifecycleColumnMissing(error)) throw error;
      latestKey = await prisma.groupE2EKey.findFirst({
        where: { groupId: group.id },
        orderBy: { version: "desc" },
        select: { id: true, version: true },
      });
    }

    const latestVersion = await prisma.groupE2EKey.findFirst({ where: { groupId: group.id }, orderBy: { version: "desc" }, select: { version: true } });
    const targetKey =
      typeof requestedVersion === "number"
        ? await prisma.groupE2EKey.findFirst({
            where: { groupId: group.id, version: requestedVersion },
            select: { id: true, version: true },
          })
        : latestKey;

    const encrypted = targetKey
      ? await prisma.groupE2EKeyMember.findFirst({
          where: { groupKeyId: targetKey.id, userId: user.id },
          select: { encryptedKey: true },
        })
      : null;

    let members: Array<{ userId: string; publicKey: string | null }> | undefined;
    let keyHolders: string[] | undefined;
    if (includeMembers && (group.myRole === "owner" || group.myRole === "admin" || !targetKey)) {
      const rawMembers = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT gm."userId"
        FROM "GroupMember" gm
        WHERE gm."groupId" = ${group.id}
      `;
      const uniqueUserIds = new Set(rawMembers.map((member) => member.userId));
      uniqueUserIds.add(group.ownerId);
      const publicKeys = await getUserPublicKeys(Array.from(uniqueUserIds));
      members = Array.from(uniqueUserIds).map((memberUserId) => ({
        userId: memberUserId,
        publicKey: publicKeys.get(memberUserId) ?? null,
      }));
    }
    if (targetKey) {
      const holderRows = await prisma.groupE2EKeyMember.findMany({
        where: { groupKeyId: targetKey.id },
        select: { userId: true },
      });
      keyHolders = holderRows.map((row) => row.userId);
    }

    const canShareHistory = group.myRole === "owner" || group.myRole === "admin";
    const keyHistory = includeMembers && canShareHistory
      ? await prisma.groupE2EKey.findMany({ where: { groupId: group.id }, orderBy: { version: "desc" }, select: { version: true, members: { select: { userId: true } } } })
      : undefined;
    if (targetKey && !encrypted) {
      await requestSharedHistoryKeys("group", group.id, link, group.ownerId, user.id);
    }
    const res = jsonOk({
      groupId: group.id,
      keyVersion: targetKey?.version ?? null,
      latestVersion: latestVersion?.version ?? null,
      encryptedKey: encrypted?.encryptedKey ? decryptE2ESecretFromDb(encrypted.encryptedKey) : null,
      members,
      keyHolders,
      keyHistory: keyHistory?.map(key => ({ version: key.version, keyHolders: key.members.map(member => member.userId) })),
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const group = await resolveGroupMembership(user.id, link);
    if (!group) {
      throw new HttpError(403, "Вы не состоите в этой группе");
    }
    const hasExistingKey = await prisma.groupE2EKey.findFirst({
      where: { groupId: group.id },
      select: { id: true },
    });
    if (group.myRole !== "owner" && group.myRole !== "admin" && hasExistingKey) {
      throw new HttpError(403, "Недостаточно прав для ротации ключей");
    }

    const rawBody = new TextDecoder().decode(await readRequestBody(req, 2 * 1024 * 1024));
    if (!rawBody.trim()) {
      throw new HttpError(400, "Некорректное тело запроса");
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Некорректное тело запроса");
    }
    const payload = rotateSchema.parse(parsedBody);
    const memberRows = await prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT "userId"
      FROM "GroupMember"
      WHERE "groupId" = ${group.id}
    `;
    const memberIds = new Set(memberRows.map((row) => row.userId));
    memberIds.add(group.ownerId);
    const uniqueKeys = new Map(
      payload.keys
        .filter((item) => memberIds.has(item.userId))
        .map((item) => [item.userId, item.encryptedKey]),
    );

    if (uniqueKeys.size === 0) {
      throw new HttpError(400, "Not enough keys for recipients");
    }
    const existingBefore = await prisma.groupE2EKey.findFirst({
      where: { groupId: group.id, version: payload.version },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"group-e2e:" + group.id}))`;
      const currentMembers = await tx.groupMember.findMany({ where: { groupId: group.id }, select: { userId: true, role: true } });
      const currentIds = new Set(currentMembers.map(m => m.userId));
      currentIds.add(group.ownerId);
      if (!currentIds.has(user.id) || (hasExistingKey && !(currentMembers.some(m => m.userId === user.id && (m.role === "owner" || m.role === "admin"))))) throw new HttpError(403, "Недостаточно прав для ротации ключей");
      // Reject a stale recipient snapshot; do not publish an epoch already known to a removed member.
      if (payload.keys.some(k => !currentIds.has(k.userId))) throw new HttpError(409, "Состав чата изменился. Повторите отправку.");
      const latest = await tx.groupE2EKey.findFirst({
        where: { groupId: group.id }, orderBy: { version: "desc" }, select: { version: true },
      });
      if (!existingBefore && latest && payload.version <= latest.version) {
        throw new HttpError(409, "Key version must increase. Reload and retry.");
      }
      let groupKey = await tx.groupE2EKey.findFirst({
        where: { groupId: group.id, version: payload.version },
        select: { id: true },
      });
      const versionExists = Boolean(groupKey);
      const isNewVersion = !versionExists;
      if (!isNewVersion && !existingBefore) {
        throw new HttpError(409, "Version already exists. Reload latest key version and retry.");
      }
      if (isNewVersion && !uniqueKeys.has(user.id)) {
        throw new HttpError(400, "Missing sender key");
      }
      if (!groupKey) {
        const groupKeyId = randomUUID();
        try {
          await tx.groupE2EKey.updateMany({
            where: { groupId: group.id, status: "active" },
            data: { status: "rotated", rotatedAt: new Date() },
          });
          await tx.groupE2EKey.create({
            data: {
              id: groupKeyId,
              groupId: group.id,
              version: payload.version,
              status: "active",
              algorithm: "aes-256-gcm+wrapped-group-key",
              createdById: user.id,
            },
          });
        } catch (error) {
          if (!isLifecycleColumnMissing(error)) throw error;
          await tx.groupE2EKey.create({
            data: {
              id: groupKeyId,
              groupId: group.id,
              version: payload.version,
              createdById: user.id,
            },
          });
        }
        groupKey = { id: groupKeyId };
      }
      // Rewrapping an existing version must not reactivate retired keys.

      for (const [recipientUserId, encryptedKey] of uniqueKeys.entries()) {
        await tx.groupE2EKeyMember.upsert({
          where: {
            groupKeyId_userId: {
              groupKeyId: groupKey!.id,
              userId: recipientUserId,
            },
          },
          update: {
            encryptedKey: encryptE2ESecretForDb(encryptedKey),
          },
          create: {
            id: randomUUID(),
            groupKeyId: groupKey!.id,
            userId: recipientUserId,
            encryptedKey: encryptE2ESecretForDb(encryptedKey),
          },
        });
      }
    });

    await notifySharedKeysReady("group", link, payload.version, Array.from(uniqueKeys.keys()));
    const res = jsonOk({ updated: true, version: payload.version });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
