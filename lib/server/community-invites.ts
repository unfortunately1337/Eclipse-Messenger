import { readJsonBody } from "./request-body";
import { randomBytes, randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "./prisma";
import { requireUserFromRequest } from "./auth";
import { ensureCsrfCookie, verifyCsrf } from "./csrf";
import { HttpError, applyCors, jsonError, jsonOk } from "./http";
import { normalizeLink } from "./validation";

type Kind = "group" | "channel";
type Invite = { id: string; token: string; isPrimary: boolean; name: string | null; expiresAt: Date | null; usageLimit: number | null; usageCount: number; revokedAt: Date | null; createdAt: Date };
const createSchema = z.object({ additional: z.boolean().optional(), name: z.string().trim().max(64).optional(), expiresIn: z.number().int().min(60).max(31536000).nullable().optional(), usageLimit: z.number().int().min(1).max(100000).nullable().optional() });

export async function communityInvites(req: NextRequest, kind: Kind, rawLink: string) {
  try {
    if (req.method !== "GET") verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const link = normalizeLink(rawLink);
    const entity = kind === "group"
      ? await prisma.group.findUnique({ where: { link }, include: { members: { where: { userId: user.id } } } })
      : await prisma.channel.findUnique({ where: { link }, include: { subscribers: { where: { userId: user.id } } } });
    const membership = entity && ("members" in entity ? entity.members[0] : entity.subscribers[0]);
    if (!entity || (entity.ownerId !== user.id && (!membership?.canGenerateInviteLink || (kind === "channel" && membership.role !== "admin")))) throw new HttpError(403, "Нет прав для управления приглашениями");
    const data = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invites:${kind}:${entity.id}`}))`;
      const list = () => tx.$queryRaw<Invite[]>`SELECT "id", "token", "isPrimary", "name", "expiresAt", "usageLimit", "usageCount", "revokedAt", "createdAt" FROM "InviteLink" WHERE "revokedAt" IS NULL AND ((${kind} = 'group' AND "groupId" = ${entity.id}) OR (${kind} = 'channel' AND "channelId" = ${entity.id})) ORDER BY "isPrimary" DESC, "revokedAt" NULLS FIRST, "createdAt" DESC LIMIT 101`;
      let rows = await list();
      if (req.method === "POST") {
        const parsed = createSchema.safeParse(await readJsonBody(req));
        if (!parsed.success) throw new HttpError(400, "Некорректные параметры приглашения");
        const input = parsed.data, primary = !input.additional;
        if (!primary || !rows.some(row => row.isPrimary && !row.revokedAt)) {
          if (rows.filter(row => !row.revokedAt && !row.isPrimary).length >= 100) throw new HttpError(400, "Можно создать не более 100 дополнительных ссылок");
          const token = randomBytes(24).toString("hex"), expiry = !primary && input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null;
          await tx.$executeRaw`INSERT INTO "InviteLink" ("id", "token", "type", "groupId", "channelId", "createdById", "createdAt", "isPrimary", "name", "expiresAt", "usageLimit") VALUES (${randomUUID()}, ${token}, ${kind}, ${kind === "group" ? entity.id : null}, ${kind === "channel" ? entity.id : null}, ${user.id}, NOW(), ${primary}, ${primary ? null : input.name || null}, ${expiry}, ${primary ? null : input.usageLimit ?? null})`;
        }
      } else if (req.method === "DELETE") {
        const parsed = z.object({ token: z.string().optional(), regenerate: z.boolean().optional() }).safeParse(await readJsonBody(req));
        if (!parsed.success) throw new HttpError(400, "Некорректные параметры приглашения");
        const body = parsed.data;
        const target = rows.find(row => body.token ? row.token === body.token : row.isPrimary && !row.revokedAt);
        if (!target) throw new HttpError(404, "Ссылка не найдена");
        await tx.$executeRaw`UPDATE "InviteLink" SET "revokedAt" = NOW() WHERE "id" = ${target.id}`;
        if (target.isPrimary && body.regenerate) await tx.$executeRaw`INSERT INTO "InviteLink" ("id", "token", "type", "groupId", "channelId", "createdById", "createdAt", "isPrimary") VALUES (${randomUUID()}, ${randomBytes(24).toString("hex")}, ${kind}, ${kind === "group" ? entity.id : null}, ${kind === "channel" ? entity.id : null}, ${user.id}, NOW(), true)`;
      }
      rows = await list();
      return { token: rows.find(row => row.isPrimary && !row.revokedAt)?.token ?? null, links: rows };
    });
    const res = jsonOk(data);
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) { return applyCors(req, jsonError(error)); }
}
