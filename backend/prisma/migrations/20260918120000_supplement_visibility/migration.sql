-- Per-member supplement visibility. Until now the catalogue was gym-wide only,
-- so a gym admin had no way to recommend an item to one member.

-- AlterTable
ALTER TABLE "supplements" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplements_gymId_isPrivate_idx" ON "supplements"("gymId", "isPrivate");

-- CreateTable
CREATE TABLE IF NOT EXISTS "supplement_assignments" (
    "id" TEXT NOT NULL,
    "supplementId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplement_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplement_assignments_supplementId_memberId_key" ON "supplement_assignments"("supplementId", "memberId");
CREATE INDEX IF NOT EXISTS "supplement_assignments_memberId_idx" ON "supplement_assignments"("memberId");
CREATE INDEX IF NOT EXISTS "supplement_assignments_gymId_idx" ON "supplement_assignments"("gymId");

-- AddForeignKey
ALTER TABLE "supplement_assignments"
  ADD CONSTRAINT "supplement_assignments_supplementId_fkey"
  FOREIGN KEY ("supplementId") REFERENCES "supplements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplement_assignments"
  ADD CONSTRAINT "supplement_assignments_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
