-- CreateTable
CREATE TABLE "activity_runs" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "calories" INTEGER,
    "avgPaceSecPerKm" INTEGER,
    "route" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_runs_memberId_startedAt_idx" ON "activity_runs"("memberId", "startedAt");

-- CreateIndex
CREATE INDEX "activity_runs_gymId_idx" ON "activity_runs"("gymId");

-- AddForeignKey
ALTER TABLE "activity_runs" ADD CONSTRAINT "activity_runs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

