-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('ZOOM', 'TEAMS', 'SHAREPOINT', 'GOOGLE_DRIVE', 'SMARTVAULT', 'REDTAIL', 'WEALTHBOX', 'SALESFORCE', 'DOCUSIGN', 'RIA_IN_A_BOX', 'COMPLYSCI', 'SLACK', 'TEAMS_BOT');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'WARNING_RETRYING', 'ERROR_ACTION_REQUIRED', 'NOT_CONNECTED');

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "config" JSONB NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncLog" (
    "id" TEXT NOT NULL,
    "integrationConfigId" TEXT,
    "meetingId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "source" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationCredential_workspaceId_idx" ON "IntegrationCredential"("workspaceId");

-- CreateIndex
CREATE INDEX "IntegrationCredential_provider_status_idx" ON "IntegrationCredential"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_workspaceId_provider_key" ON "IntegrationCredential"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationConfig_workspaceId_idx" ON "IntegrationConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_workspaceId_provider_key" ON "IntegrationConfig"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_integrationConfigId_idx" ON "IntegrationSyncLog"("integrationConfigId");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_meetingId_idx" ON "IntegrationSyncLog"("meetingId");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_provider_status_idx" ON "IntegrationSyncLog"("provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_createdAt_idx" ON "IntegrationSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncLog" ADD CONSTRAINT "IntegrationSyncLog_integrationConfigId_fkey" FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncLog" ADD CONSTRAINT "IntegrationSyncLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
