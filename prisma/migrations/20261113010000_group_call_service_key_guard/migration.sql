-- Server-created call service events have no client encryption epoch. Keep
-- membership checks and the active-key requirement for ordinary messages.
CREATE OR REPLACE FUNCTION eclipse_require_active_shared_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'GroupMessage' THEN
    PERFORM pg_advisory_xact_lock(hashtext('group-e2e:' || NEW."groupId"));
    IF NEW."systemPayload" IS NULL AND NOT EXISTS (SELECT 1 FROM "GroupE2EKey" WHERE "groupId" = NEW."groupId" AND "version" = NEW."keyVersion" AND "status" = 'active') THEN
      RAISE EXCEPTION 'ECLIPSE_KEY_ROTATION_REQUIRED';
    END IF;
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM "GroupMember" WHERE "groupId" = NEW."groupId" AND "userId" = NEW."senderId") THEN
      RAISE EXCEPTION 'ECLIPSE_MEMBERSHIP_REQUIRED';
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('channel-e2e:' || NEW."channelId"));
    IF NOT EXISTS (SELECT 1 FROM "ChannelE2EKey" WHERE "channelId" = NEW."channelId" AND "version" = NEW."keyVersion" AND "status" = 'active') THEN
      RAISE EXCEPTION 'ECLIPSE_KEY_ROTATION_REQUIRED';
    END IF;
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM "ChannelSubscriber" WHERE "channelId" = NEW."channelId" AND "userId" = NEW."authorId")
      AND NOT EXISTS (SELECT 1 FROM "Channel" WHERE "id" = NEW."channelId" AND "ownerId" = NEW."authorId") THEN
      RAISE EXCEPTION 'ECLIPSE_MEMBERSHIP_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END $$;
