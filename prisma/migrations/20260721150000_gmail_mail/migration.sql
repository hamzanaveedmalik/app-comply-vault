-- Gmail mail ingestion adapter — enum extensions only (reuses M365 mailbox/evidence tables).

-- AlterEnum MailboxProvider
ALTER TYPE "MailboxProvider" ADD VALUE IF NOT EXISTS 'GMAIL';

-- AlterEnum CommunicationChannel
ALTER TYPE "CommunicationChannel" ADD VALUE IF NOT EXISTS 'EMAIL_GMAIL';

-- AlterEnum IntegrationProvider
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'GMAIL_MAIL';
