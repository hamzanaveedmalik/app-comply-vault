-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'ZOHO_CRM';

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "zohoCrmContactId" TEXT,
ADD COLUMN "zohoCrmNotePostedAt" TIMESTAMP(3);
