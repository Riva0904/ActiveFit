-- How many sessions a week the member is aiming for. Defaults to 3, which is
-- what the Home screen assumed before the field existed.

-- AlterTable
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "weeklyGoal" INTEGER NOT NULL DEFAULT 3;
