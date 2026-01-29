-- Update BillingStatus enum values
ALTER TYPE "BillingStatus" RENAME VALUE 'CANCELLED' TO 'CANCELED';
ALTER TYPE "BillingStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "BillingStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'SOLO', 'TEAM');

-- CreateEnum
CREATE TYPE "BillingCurrency" AS ENUM ('USD', 'GBP');

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "billingCurrency" "BillingCurrency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "trialStartedAt" TIMESTAMP(3),
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "onboardingType" TEXT,
  ADD COLUMN "onboardingPaidAt" TIMESTAMP(3);
