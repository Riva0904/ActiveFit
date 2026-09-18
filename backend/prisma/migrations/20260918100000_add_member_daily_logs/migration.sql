-- One row per member per calendar day: the Home checklist ticks plus water and
-- calories. The checklist previously lived only in an in-memory store on the
-- device, so it was lost on restart and invisible to trainers and admins.

-- CreateTable
CREATE TABLE IF NOT EXISTS "member_daily_logs" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "items" JSONB NOT NULL DEFAULT '{}',
    "waterMl" INTEGER NOT NULL DEFAULT 0,
    "caloriesIn" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_daily_logs_memberId_date_key" ON "member_daily_logs"("memberId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "member_daily_logs_gymId_date_idx" ON "member_daily_logs"("gymId", "date");

-- AddForeignKey
ALTER TABLE "member_daily_logs"
  ADD CONSTRAINT "member_daily_logs_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
