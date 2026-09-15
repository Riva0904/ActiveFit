-- CreateEnum
CREATE TYPE "SaasBillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SaasPaymentStatus" AS ENUM ('AWAITING_PAYMENT', 'SUBMITTED', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "gym_subscriptions" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "billingPeriod" "SaasBillingPeriod" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "grantedByUserId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'UPI_MANUAL',
ADD COLUMN     "supersededById" TEXT;

-- CreateTable
CREATE TABLE "gym_subscription_payments" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingPeriod" "SaasBillingPeriod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "status" "SaasPaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "payeeVpa" TEXT NOT NULL,
    "upiReference" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "bankReference" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectionReason" TEXT,
    "subscriptionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "upiVpa" TEXT,
    "upiPayeeName" TEXT,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "supportEmail" TEXT,
    "gstPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gym_subscription_payments_referenceCode_key" ON "gym_subscription_payments"("referenceCode");

-- CreateIndex
CREATE INDEX "gym_subscription_payments_status_submittedAt_idx" ON "gym_subscription_payments"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "gym_subscription_payments_gymId_createdAt_idx" ON "gym_subscription_payments"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "gym_subscriptions_gymId_status_idx" ON "gym_subscriptions"("gymId", "status");

-- CreateIndex
CREATE INDEX "gym_subscriptions_status_endDate_idx" ON "gym_subscriptions"("status", "endDate");

-- AddForeignKey
ALTER TABLE "gym_subscription_payments" ADD CONSTRAINT "gym_subscription_payments_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_subscription_payments" ADD CONSTRAINT "gym_subscription_payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_subscription_payments" ADD CONSTRAINT "gym_subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "gym_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

