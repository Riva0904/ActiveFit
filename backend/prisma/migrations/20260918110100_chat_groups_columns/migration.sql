-- Group chat: a GROUP conversation is a ChatConversation with peerId NULL,
-- userId = its creator, and its people in chat_participants.

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "avatar" TEXT;

-- The partial index added with direct chat guarded "one peer-less thread per
-- person per type" for SUPPORT (and leftover GYM) rows. A group is also
-- peer-less and also keyed to its creator, so as written it capped each gym
-- admin at exactly ONE group. Narrow it to the two types it was meant for.
DROP INDEX IF EXISTS "chat_conversations_gym_user_type_nopeer_key";
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_gym_user_type_nopeer_key"
  ON "chat_conversations" ("gymId", "userId", "type")
  WHERE "peerId" IS NULL AND "type" IN ('SUPPORT', 'GYM');

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_conversations_gymId_type_idx" ON "chat_conversations"("gymId", "type");

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChatParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "unread" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_participants_conversationId_userId_key" ON "chat_participants"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "chat_participants_userId_isActive_idx" ON "chat_participants"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "chat_participants_conversationId_idx" ON "chat_participants"("conversationId");

-- AddForeignKey
ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
