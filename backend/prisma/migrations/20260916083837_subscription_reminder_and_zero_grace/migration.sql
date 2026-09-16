-- AlterTable
ALTER TABLE "gym_subscriptions" ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "platform_settings" ALTER COLUMN "graceDays" SET DEFAULT 0;


-- Existing rows keep the old 7-day grace until explicitly reset. The product
-- decision is that a plan goes inactive the day it expires, so bring the
-- singleton in line rather than leaving new and existing installs different.
UPDATE "platform_settings" SET "graceDays" = 0 WHERE "graceDays" = 7;
