import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toNumber(value) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10);
  return 0;
}

function stringifyRow(row) {
  return JSON.stringify(row, (_, value) => (typeof value === "bigint" ? value.toString() : value));
}

const checks = [
  {
    id: "direct_payload_shape",
    severity: "critical",
    title: "Direct messages with broken encrypted payload shape",
    remediation: "Backfill/correct Message.cipherText/iv/encryptedKeyFor* for corrupted rows before release.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM "Message" m
      WHERE (m."cipherText" IS NULL
        OR m."iv" IS NULL
        OR m."encryptedKeyForSender" IS NULL
        OR m."encryptedKeyForRecipient" IS NULL)
        AND m."isSystemMessage" = false
    `,
  },
  {
    id: "group_payload_shape",
    severity: "critical",
    title: "Group messages with inconsistent encrypted payload shape",
    remediation: "Ensure GroupMessage rows use full encrypted tuple (cipherText+iv+keyVersion) or explicit plaintext migration policy.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM "GroupMessage" gm
      WHERE
        (gm."cipherText" IS NOT NULL OR gm."iv" IS NOT NULL OR gm."keyVersion" IS NOT NULL)
        AND NOT (gm."cipherText" IS NOT NULL AND gm."iv" IS NOT NULL AND gm."keyVersion" IS NOT NULL)
    `,
  },
  {
    id: "channel_payload_shape",
    severity: "critical",
    title: "Channel posts with inconsistent encrypted payload shape",
    remediation: "Ensure ChannelPost rows use full encrypted tuple (cipherText+iv+keyVersion) or explicit plaintext migration policy.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM "ChannelPost" cp
      WHERE
        (cp."cipherText" IS NOT NULL OR cp."iv" IS NOT NULL OR cp."keyVersion" IS NOT NULL)
        AND NOT (cp."cipherText" IS NOT NULL AND cp."iv" IS NOT NULL AND cp."keyVersion" IS NOT NULL)
    `,
  },
  {
    id: "group_message_missing_keyversion_mapping",
    severity: "critical",
    title: "Group encrypted messages referencing missing GroupE2EKey version",
    remediation: "Restore missing GroupE2EKey rows or rewrite affected GroupMessage.keyVersion values.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM "GroupMessage" gm
      WHERE gm."keyVersion" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "GroupE2EKey" gk
          WHERE gk."groupId" = gm."groupId"
            AND gk."version" = gm."keyVersion"
        )
    `,
  },
  {
    id: "channel_message_missing_keyversion_mapping",
    severity: "critical",
    title: "Channel encrypted messages referencing missing ChannelE2EKey version",
    remediation: "Restore missing ChannelE2EKey rows or rewrite affected ChannelPost.keyVersion values.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM "ChannelPost" cp
      WHERE cp."keyVersion" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "ChannelE2EKey" ck
          WHERE ck."channelId" = cp."channelId"
            AND ck."version" = cp."keyVersion"
        )
    `,
  },
  {
    id: "group_latest_key_missing_holders",
    severity: "critical",
    title: "Group members missing wrapped key for latest active version",
    remediation: "Run shared-key reconcile/rotation for groups with missing GroupE2EKeyMember rows.",
    query: `
      WITH latest AS (
        SELECT DISTINCT ON ("groupId") gk."id", gk."groupId"
        FROM "GroupE2EKey" gk
        WHERE gk."status" = 'active'
        ORDER BY gk."groupId", gk."version" DESC, gk."createdAt" DESC
      ),
      members AS (
        SELECT gm."groupId", gm."userId" FROM "GroupMember" gm
        UNION
        SELECT g."id" AS "groupId", g."ownerId" AS "userId" FROM "Group" g
      )
      SELECT COUNT(*)::bigint AS value
      FROM latest l
      JOIN members m ON m."groupId" = l."groupId"
      LEFT JOIN "GroupE2EKeyMember" gkm
        ON gkm."groupKeyId" = l."id"
       AND gkm."userId" = m."userId"
      WHERE gkm."id" IS NULL
    `,
    detailsQuery: `
      WITH latest AS (
        SELECT DISTINCT ON ("groupId") gk."id", gk."groupId"
        FROM "GroupE2EKey" gk
        WHERE gk."status" = 'active'
        ORDER BY gk."groupId", gk."version" DESC, gk."createdAt" DESC
      ),
      members AS (
        SELECT gm."groupId", gm."userId" FROM "GroupMember" gm
        UNION
        SELECT g."id" AS "groupId", g."ownerId" AS "userId" FROM "Group" g
      )
      SELECT l."groupId", m."userId"
      FROM latest l
      JOIN members m ON m."groupId" = l."groupId"
      LEFT JOIN "GroupE2EKeyMember" gkm
        ON gkm."groupKeyId" = l."id"
       AND gkm."userId" = m."userId"
      WHERE gkm."id" IS NULL
      ORDER BY l."groupId", m."userId"
      LIMIT 20
    `,
  },
  {
    id: "channel_latest_key_missing_holders",
    severity: "critical",
    title: "Channel subscribers missing wrapped key for latest active version",
    remediation: "Run shared-key reconcile/rotation for channels with missing ChannelE2EKeyMember rows.",
    query: `
      WITH latest AS (
        SELECT DISTINCT ON ("channelId") ck."id", ck."channelId"
        FROM "ChannelE2EKey" ck
        WHERE ck."status" = 'active'
        ORDER BY ck."channelId", ck."version" DESC, ck."createdAt" DESC
      ),
      members AS (
        SELECT cs."channelId", cs."userId" FROM "ChannelSubscriber" cs
        UNION
        SELECT c."id" AS "channelId", c."ownerId" AS "userId" FROM "Channel" c
      )
      SELECT COUNT(*)::bigint AS value
      FROM latest l
      JOIN members m ON m."channelId" = l."channelId"
      LEFT JOIN "ChannelE2EKeyMember" ckm
        ON ckm."channelKeyId" = l."id"
       AND ckm."userId" = m."userId"
      WHERE ckm."id" IS NULL
    `,
    detailsQuery: `
      WITH latest AS (
        SELECT DISTINCT ON ("channelId") ck."id", ck."channelId"
        FROM "ChannelE2EKey" ck
        WHERE ck."status" = 'active'
        ORDER BY ck."channelId", ck."version" DESC, ck."createdAt" DESC
      ),
      members AS (
        SELECT cs."channelId", cs."userId" FROM "ChannelSubscriber" cs
        UNION
        SELECT c."id" AS "channelId", c."ownerId" AS "userId" FROM "Channel" c
      )
      SELECT l."channelId", m."userId"
      FROM latest l
      JOIN members m ON m."channelId" = l."channelId"
      LEFT JOIN "ChannelE2EKeyMember" ckm
        ON ckm."channelKeyId" = l."id"
       AND ckm."userId" = m."userId"
      WHERE ckm."id" IS NULL
      ORDER BY l."channelId", m."userId"
      LIMIT 20
    `,
  },
  {
    id: "active_users_without_recoverable_identity",
    severity: "critical",
    title: "Active chat users without recoverable E2E identity",
    remediation: "Ensure active users have publicKey and private key backup in User/UserE2EKey before cutover.",
    query: `
      WITH active_users AS (
        SELECT m."senderId" AS "userId" FROM "Message" m
        UNION
        SELECT cp."userId" FROM "ConversationParticipant" cp
        UNION
        SELECT gm."senderId" FROM "GroupMessage" gm
        UNION
        SELECT gm2."userId" FROM "GroupMember" gm2
        UNION
        SELECT cp2."authorId" FROM "ChannelPost" cp2
        UNION
        SELECT cs."userId" FROM "ChannelSubscriber" cs
      )
      SELECT COUNT(*)::bigint AS value
      FROM active_users au
      JOIN "User" u ON u."id" = au."userId"
      WHERE
        u."publicKey" IS NULL
        OR (
          u."privateKeyBackupEnc" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "UserE2EKey" uk
            WHERE uk."userId" = u."id"
              AND uk."privateKeyBackupEnc" IS NOT NULL
          )
        )
    `,
    detailsQuery: `
      WITH active_users AS (
        SELECT m."senderId" AS "userId" FROM "Message" m
        UNION
        SELECT cp."userId" FROM "ConversationParticipant" cp
        UNION
        SELECT gm."senderId" FROM "GroupMessage" gm
        UNION
        SELECT gm2."userId" FROM "GroupMember" gm2
        UNION
        SELECT cp2."authorId" FROM "ChannelPost" cp2
        UNION
        SELECT cs."userId" FROM "ChannelSubscriber" cs
      )
      SELECT u."id" AS "userId", u."link"
      FROM active_users au
      JOIN "User" u ON u."id" = au."userId"
      WHERE
        u."publicKey" IS NULL
        OR (
          u."privateKeyBackupEnc" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "UserE2EKey" uk
            WHERE uk."userId" = u."id"
              AND uk."privateKeyBackupEnc" IS NOT NULL
          )
        )
      ORDER BY u."link" NULLS LAST, u."id"
      LIMIT 20
    `,
  },
  {
    id: "multiple_active_user_keys",
    severity: "warn",
    title: "Users with multiple active UserE2EKey rows",
    remediation: "Normalize UserE2EKey.status/isActive so one active identity remains per user.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM (
        SELECT uk."userId"
        FROM "UserE2EKey" uk
        WHERE uk."status" = 'active'
        GROUP BY uk."userId"
        HAVING COUNT(*) > 1
      ) t
    `,
    detailsQuery: `
      SELECT uk."userId", COUNT(*)::bigint AS "activeCount"
      FROM "UserE2EKey" uk
      WHERE uk."status" = 'active'
      GROUP BY uk."userId"
      HAVING COUNT(*) > 1
      ORDER BY "activeCount" DESC, uk."userId"
      LIMIT 20
    `,
  },
  {
    id: "multiple_active_group_keys",
    severity: "warn",
    title: "Groups with multiple active GroupE2EKey rows",
    remediation: "Normalize GroupE2EKey.status so one active key version remains per group.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM (
        SELECT gk."groupId"
        FROM "GroupE2EKey" gk
        WHERE gk."status" = 'active'
        GROUP BY gk."groupId"
        HAVING COUNT(*) > 1
      ) t
    `,
    detailsQuery: `
      SELECT gk."groupId", COUNT(*)::bigint AS "activeCount"
      FROM "GroupE2EKey" gk
      WHERE gk."status" = 'active'
      GROUP BY gk."groupId"
      HAVING COUNT(*) > 1
      ORDER BY "activeCount" DESC, gk."groupId"
      LIMIT 20
    `,
  },
  {
    id: "multiple_active_channel_keys",
    severity: "warn",
    title: "Channels with multiple active ChannelE2EKey rows",
    remediation: "Normalize ChannelE2EKey.status so one active key version remains per channel.",
    query: `
      SELECT COUNT(*)::bigint AS value
      FROM (
        SELECT ck."channelId"
        FROM "ChannelE2EKey" ck
        WHERE ck."status" = 'active'
        GROUP BY ck."channelId"
        HAVING COUNT(*) > 1
      ) t
    `,
    detailsQuery: `
      SELECT ck."channelId", COUNT(*)::bigint AS "activeCount"
      FROM "ChannelE2EKey" ck
      WHERE ck."status" = 'active'
      GROUP BY ck."channelId"
      HAVING COUNT(*) > 1
      ORDER BY "activeCount" DESC, ck."channelId"
      LIMIT 20
    `,
  },
];

async function run() {
  console.log("E2E preflight check started");
  console.log(`Database: ${process.env.DATABASE_URL ? "configured" : "missing DATABASE_URL"}`);

  const results = [];
  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe(check.query);
    const value = Array.isArray(rows) && rows.length > 0 ? toNumber(rows[0].value) : 0;
    let details = [];
    if (value > 0 && check.detailsQuery) {
      details = await prisma.$queryRawUnsafe(check.detailsQuery);
    }
    results.push({ ...check, value, details });
  }

  const critical = results.filter((r) => r.severity === "critical" && r.value > 0);
  const warns = results.filter((r) => r.severity === "warn" && r.value > 0);

  for (const result of results) {
    const status = result.value > 0 ? (result.severity === "critical" ? "FAIL" : "WARN") : "OK";
    console.log(`[${status}] ${result.id} -> ${result.value}`);
    if (result.value > 0) {
      console.log(`  ${result.title}`);
      console.log(`  remediation: ${result.remediation}`);
      if (Array.isArray(result.details) && result.details.length > 0) {
        console.log("  examples:");
        for (const detail of result.details) {
          console.log(`    - ${stringifyRow(detail)}`);
        }
      }
    }
  }

  if (critical.length > 0) {
    console.error(`Preflight failed: ${critical.length} critical checks have issues.`);
    process.exitCode = 1;
    return;
  }
  if (warns.length > 0) {
    console.warn(`Preflight passed with warnings: ${warns.length}.`);
  } else {
    console.log("Preflight passed: no critical/warn issues found.");
  }
}

run()
  .catch((error) => {
    console.error("E2E preflight check crashed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
