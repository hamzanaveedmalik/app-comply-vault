-- AlterTable
ALTER TABLE "Client" ADD COLUMN "lastContactAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Client_workspaceId_lastContactAt_idx" ON "Client"("workspaceId", "lastContactAt");

-- CreateEnum
CREATE TYPE "HouseholdMemberRole" AS ENUM ('PRIMARY', 'SPOUSE', 'JOINT');

-- CreateEnum
CREATE TYPE "ClientActivityType" AS ENUM ('EMAIL_RECEIVED', 'EMAIL_SENT', 'EMAIL_INTERNAL', 'TRIAGE_ATTACHED');

-- CreateTable
CREATE TABLE "ClientHousehold" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientHousehold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientHouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" "HouseholdMemberRole" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientHouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientActivityType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "direction" "CommunicationDirection",
    "counterparties" TEXT[],
    "evidenceItemId" TEXT,
    "threadId" TEXT,
    "contentSha256" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientHousehold_workspaceId_idx" ON "ClientHousehold"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientHouseholdMember_clientId_idx" ON "ClientHouseholdMember"("clientId");

-- CreateIndex
CREATE INDEX "ClientHouseholdMember_householdId_role_idx" ON "ClientHouseholdMember"("householdId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ClientHouseholdMember_householdId_clientId_key" ON "ClientHouseholdMember"("householdId", "clientId");

-- CreateIndex
CREATE INDEX "ClientActivity_workspaceId_clientId_occurredAt_idx" ON "ClientActivity"("workspaceId", "clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClientActivity_workspaceId_occurredAt_idx" ON "ClientActivity"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClientActivity_threadId_idx" ON "ClientActivity"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientActivity_workspaceId_evidenceItemId_clientId_key" ON "ClientActivity"("workspaceId", "evidenceItemId", "clientId");

-- AddForeignKey
ALTER TABLE "ClientHousehold" ADD CONSTRAINT "ClientHousehold_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHouseholdMember" ADD CONSTRAINT "ClientHouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "ClientHousehold"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHouseholdMember" ADD CONSTRAINT "ClientHouseholdMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
