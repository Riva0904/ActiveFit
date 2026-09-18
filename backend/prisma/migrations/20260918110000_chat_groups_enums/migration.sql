-- Enum changes only. Postgres refuses to use a newly added enum value in the
-- same transaction that added it, so the columns and tables that reference
-- 'GROUP' land in the next migration.

-- AlterEnum
ALTER TYPE "ChatType" ADD VALUE IF NOT EXISTS 'GROUP';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatParticipantRole') THEN
    CREATE TYPE "ChatParticipantRole" AS ENUM ('OWNER', 'MEMBER');
  END IF;
END
$$;
