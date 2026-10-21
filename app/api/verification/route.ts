import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { readJsonBody } from "@/lib/server/request-body";
import { prisma } from "@/lib/server/prisma";

const schema = z.object({ entities: z.array(z.object({ kind: z.enum(["user", "group", "channel"]), link: z.string().trim().min(1).max(128) })).max(100) });
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const body = schema.parse(await readJsonBody(req, 32 * 1024));
    const entities = [...new Map(body.entities.map(entity => {
      const normalized = { ...entity, link: entity.link.replace(/^@+/, "").toLowerCase() };
      return [`${normalized.kind}:${normalized.link}`, normalized] as const;
    })).values()];
    if (!entities.length) return applyCors(req, jsonOk({ entities: [] }));
    const values = Prisma.join(entities.map(entity => Prisma.sql`(${entity.kind}::text, ${entity.link}::text)`));
    const rows = await prisma.$queryRaw<Array<{ kind: string; link: string; isVerified: boolean; emojiStatusId: string | null }>>`
      WITH requested(kind, link) AS (VALUES ${values})
      SELECT r.kind, r.link, u."isVerified", u."emojiStatusId" FROM requested r JOIN "User" u
        ON r.kind = 'user' AND lower(u."link") = r.link
      UNION ALL
      SELECT r.kind, r.link, g."isVerified", NULL::text AS "emojiStatusId" FROM requested r JOIN "Group" g
        ON r.kind = 'group' AND lower(g."link") = r.link
        WHERE g."isPublic" OR g."ownerId" = ${user.id} OR EXISTS
          (SELECT 1 FROM "GroupMember" m WHERE m."groupId" = g."id" AND m."userId" = ${user.id})
      UNION ALL
      SELECT r.kind, r.link, c."isVerified", NULL::text AS "emojiStatusId" FROM requested r JOIN "Channel" c
        ON r.kind = 'channel' AND lower(c."link") = r.link
        WHERE c."isPublic" OR c."ownerId" = ${user.id} OR EXISTS
          (SELECT 1 FROM "ChannelSubscriber" s WHERE s."channelId" = c."id" AND s."userId" = ${user.id})
    `;
    const flags = new Map(rows.map(row => [`${row.kind}:${row.link}`, row]));
    const response = jsonOk({ entities: entities.map(entity => {
      const appearance = flags.get(`${entity.kind}:${entity.link}`);
      return { ...entity, isVerified: appearance?.isVerified === true, emojiStatusId: entity.kind === "user" ? appearance?.emojiStatusId ?? null : null };
    }) });
    ensureCsrfCookie(req, response);
    return applyCors(req, response);
  } catch (error) { return applyCors(req, jsonError(error)); }
}
export function OPTIONS(req: NextRequest) { return handleOptions(req); }
