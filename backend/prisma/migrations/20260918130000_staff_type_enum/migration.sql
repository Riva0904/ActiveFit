-- Enum only; the column that uses it lands in the next migration, because
-- Postgres refuses to use a newly created enum value in the same transaction.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffType') THEN
    CREATE TYPE "StaffType" AS ENUM ('FRONT_DESK', 'CLEANING');
  END IF;
END
$$;
