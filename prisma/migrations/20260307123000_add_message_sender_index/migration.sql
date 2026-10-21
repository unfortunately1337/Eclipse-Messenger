-- Add index for message senderId to speed batch profile lookups and sender filtering
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
