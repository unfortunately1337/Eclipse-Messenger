BEGIN;

-- Remove only the retired AI identity, never the active Eclipse system account.
CREATE TEMP TABLE "_retired_eclipse_ai_ids" AS
SELECT "id" FROM "User"
WHERE LOWER("link") <> 'eclipse'
  AND (
    LOWER("id") = 'eclipseaibot'
    OR LOWER("link") = 'eclipseaibot'
    OR LOWER("link2") = 'eclipseaibot'
    OR LOWER("link3") = 'eclipseaibot'
    OR LOWER("link4") = 'eclipseaibot'
    OR LOWER("link5") = 'eclipseaibot'
  );

-- Personal AI conversations have no remaining recipient after retiring the bot.
DELETE FROM "Conversation" c
WHERE c."type" = 'direct'
  AND EXISTS (
    SELECT 1 FROM "ConversationParticipant" p
    JOIN "_retired_eclipse_ai_ids" b ON b."id" = p."userId"
    WHERE p."conversationId" = c."id"
  );

-- Related messages, contacts, keys and media records use existing cascade rules.
DELETE FROM "User" WHERE "id" IN (SELECT "id" FROM "_retired_eclipse_ai_ids");
DROP TABLE "_retired_eclipse_ai_ids";

COMMIT;
