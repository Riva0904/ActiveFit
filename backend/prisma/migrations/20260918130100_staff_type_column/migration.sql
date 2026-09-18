-- AlterTable
ALTER TABLE "staffs" ADD COLUMN IF NOT EXISTS "staffType" "StaffType" NOT NULL DEFAULT 'FRONT_DESK';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staffs_gymId_staffType_idx" ON "staffs"("gymId", "staffType");
