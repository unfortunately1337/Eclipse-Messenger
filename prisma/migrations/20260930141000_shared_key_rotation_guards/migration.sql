-- Serialize membership removal, key publication and message writes on the same lock.
CREATE OR REPLACE FUNCTION eclipse_retire_shared_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'GroupMember' THEN
    PERFORM pg_advisory_xact_lock(hashtext('group-e2e:' || OLD."groupId"));
    UPDATE "GroupE2EKey" SET "status" = 'rotation-required', "rotatedAt" = CURRENT_TIMESTAMP
      WHERE "groupId" = OLD."groupId" AND "status" = 'active';
    DELETE FROM "GroupE2EKeyMember" WHERE "userId" = OLD."userId"
      AND "groupKeyId" IN (SELECT "id" FROM "GroupE2EKey" WHERE "groupId" = OLD."groupId");
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('channel-e2e:' || OLD."channelId"));
    UPDATE "ChannelE2EKey" SET "status" = 'rotation-required', "rotatedAt" = CURRENT_TIMESTAMP
      WHERE "channelId" = OLD."channelId" AND "status" = 'active';
    DELETE FROM "ChannelE2EKeyMember" WHERE "userId" = OLD."userId"
      AND "channelKeyId" IN (SELECT "id" FROM "ChannelE2EKey" WHERE "channelId" = OLD."channelId");
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER eclipse_group_member_removed BEFORE DELETE ON "GroupMember"
  FOR EACH ROW EXECUTE FUNCTION eclipse_retire_shared_key();
CREATE TRIGGER eclipse_channel_member_removed BEFORE DELETE ON "ChannelSubscriber"
  FOR EACH ROW EXECUTE FUNCTION eclipse_retire_shared_key();

CREATE OR REPLACE FUNCTION eclipse_require_active_shared_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'GroupMessage' THEN
    PERFORM pg_advisory_xact_lock(hashtext('group-e2e:' || NEW."groupId"));
    IF NOT EXISTS (SELECT 1 FROM "GroupE2EKey" WHERE "groupId" = NEW."groupId" AND "version" = NEW."keyVersion" AND "status" = 'active') THEN
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
CREATE TRIGGER eclipse_group_message_key BEFORE INSERT OR UPDATE OF "cipherText", "iv", "keyVersion" ON "GroupMessage"
  FOR EACH ROW EXECUTE FUNCTION eclipse_require_active_shared_key();
CREATE TRIGGER eclipse_channel_post_key BEFORE INSERT OR UPDATE OF "cipherText", "iv", "keyVersion" ON "ChannelPost"
  FOR EACH ROW EXECUTE FUNCTION eclipse_require_active_shared_key();
