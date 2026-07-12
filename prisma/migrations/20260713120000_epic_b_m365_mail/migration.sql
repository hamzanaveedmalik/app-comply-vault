-- Epic B: Evidence layer subset + M365 mailbox integration

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('MEETING', 'EMAIL', 'MESSAGE', 'DOCUMENT', 'POLICY', 'ATTESTATION', 'NOTE', 'FINDING_RECORD');
CREATE TYPE "TagCategory" AS ENUM ('ADVICE', 'RECOMMENDATION', 'COMPLAINT', 'FEE', 'PERFORMANCE', 'MARKETING', 'REVIEW', 'VULNERABLE_CLIENT', 'OFF_CHANNEL');
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL_M365', 'WHATSAPP_IMPORT', 'SMS_IMPORT', 'TEAMS_IMPORT', 'SLACK_IMPORT', 'OTHER_IMPORT');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "ClientStatus" AS ENUM ('CLIENT', 'PROSPECT', 'FORMER');
CREATE TYPE "MailboxProvider" AS ENUM ('M365');
CREATE TYPE "MailboxSyncStatus" AS ENUM ('PENDING', 'BACKFILLING', 'ACTIVE', 'ERROR', 'DISCONNECTED');
CREATE TYPE "MailboxConsentMode" AS ENUM ('APPLICATION', 'DELEGATED');
CREATE TYPE "IngestJobKind" AS ENUM ('BACKFILL', 'DELTA', 'MESSAGE_IMPORT');
CREATE TYPE "IngestJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'DONE', 'FAILED');
CREATE TYPE "EmailTriageStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXTERNAL', 'IRRELEVANT');

-- AlterEnum IntegrationProvider
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'M365_MAIL';

-- AlterEnum AuditAction
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAILBOX_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAILBOX_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAILBOX_SYNC_STARTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAILBOX_SYNC_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EVIDENCE_VIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EVIDENCE_TAG';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_TRIAGE_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'THREAD_EXPORT';

-- CreateTable Client
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zohoId" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailAlias
CREATE TABLE "EmailAlias" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "EmailAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable EvidenceItem
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "createdById" TEXT,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentSha256" TEXT NOT NULL,
    "storageUri" TEXT,
    "retentionRuleId" TEXT,
    "destructionEligibleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable EvidenceTag
CREATE TABLE "EvidenceTag" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EvidenceTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable CommunicationThread
CREATE TABLE "CommunicationThread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "externalThreadId" TEXT,
    "subject" TEXT,
    "participants" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CommunicationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable Communication
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "internetMessageId" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "inReplyTo" TEXT,
    "referencesHeader" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable Attachment
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "storageUri" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable MailboxConnection
CREATE TABLE "MailboxConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL DEFAULT 'M365',
    "mailboxAddress" TEXT NOT NULL,
    "consentMode" "MailboxConsentMode" NOT NULL DEFAULT 'APPLICATION',
    "scopeFolders" TEXT[],
    "backfillFrom" TIMESTAMP(3),
    "status" "MailboxSyncStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedToken" TEXT,
    "deltaCursor" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable IngestJob
CREATE TABLE "IngestJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT,
    "importFileId" TEXT,
    "kind" "IngestJobKind" NOT NULL,
    "status" "IngestJobStatus" NOT NULL DEFAULT 'QUEUED',
    "cursor" TEXT,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailTriageItem
CREATE TABLE "EmailTriageItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "EmailTriageStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "clientId" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailTriageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE INDEX "Client_workspaceId_name_idx" ON "Client"("workspaceId", "name");
CREATE UNIQUE INDEX "EmailAlias_workspaceId_address_userId_clientId_key" ON "EmailAlias"("workspaceId", "address", "userId", "clientId");
CREATE INDEX "EmailAlias_workspaceId_address_idx" ON "EmailAlias"("workspaceId", "address");
CREATE INDEX "EvidenceItem_workspaceId_clientId_occurredAt_idx" ON "EvidenceItem"("workspaceId", "clientId", "occurredAt");
CREATE INDEX "EvidenceItem_workspaceId_sourceType_idx" ON "EvidenceItem"("workspaceId", "sourceType");
CREATE INDEX "EvidenceTag_itemId_idx" ON "EvidenceTag"("itemId");
CREATE INDEX "EvidenceTag_itemId_category_idx" ON "EvidenceTag"("itemId", "category");
CREATE INDEX "CommunicationThread_workspaceId_externalThreadId_idx" ON "CommunicationThread"("workspaceId", "externalThreadId");
CREATE INDEX "CommunicationThread_workspaceId_updatedAt_idx" ON "CommunicationThread"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX "Communication_evidenceItemId_key" ON "Communication"("evidenceItemId");
CREATE UNIQUE INDEX "Communication_internetMessageId_key" ON "Communication"("internetMessageId");
CREATE INDEX "Communication_threadId_sentAt_idx" ON "Communication"("threadId", "sentAt");
CREATE INDEX "Attachment_communicationId_idx" ON "Attachment"("communicationId");
CREATE UNIQUE INDEX "MailboxConnection_workspaceId_mailboxAddress_key" ON "MailboxConnection"("workspaceId", "mailboxAddress");
CREATE INDEX "MailboxConnection_workspaceId_status_idx" ON "MailboxConnection"("workspaceId", "status");
CREATE INDEX "IngestJob_workspaceId_status_idx" ON "IngestJob"("workspaceId", "status");
CREATE INDEX "IngestJob_connectionId_kind_status_idx" ON "IngestJob"("connectionId", "kind", "status");
CREATE UNIQUE INDEX "EmailTriageItem_workspaceId_address_key" ON "EmailTriageItem"("workspaceId", "address");
CREATE INDEX "EmailTriageItem_workspaceId_status_idx" ON "EmailTriageItem"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAlias" ADD CONSTRAINT "EmailAlias_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAlias" ADD CONSTRAINT "EmailAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailAlias" ADD CONSTRAINT "EmailAlias_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceTag" ADD CONSTRAINT "EvidenceTag_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxConnection" ADD CONSTRAINT "MailboxConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestJob" ADD CONSTRAINT "IngestJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestJob" ADD CONSTRAINT "IngestJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MailboxConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailTriageItem" ADD CONSTRAINT "EmailTriageItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
