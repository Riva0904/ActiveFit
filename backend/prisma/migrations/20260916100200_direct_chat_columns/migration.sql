-- The second side of a direct thread. Nullable because SUPPORT threads have
-- only one gym-side participant.
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "peerId" TEXT;
ALTER TABLE "chat_conversations" ALTER COLUMN "type" SET DEFAULT 'DIRECT';

DROP INDEX IF EXISTS "chat_conversations_gymId_userId_type_key";

CREATE INDEX IF NOT EXISTS "chat_conversations_peerId_idx" ON "chat_conversations"("peerId");
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_gymId_userId_peerId_type_key"
  ON "chat_conversations"("gymId", "userId", "peerId", "type");

ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_peerId_fkey"
  FOREIGN KEY ("peerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
