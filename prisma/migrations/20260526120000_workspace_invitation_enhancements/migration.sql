-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_REVOKED';

-- AlterTable: UserWorkspace onboarding dismiss
ALTER TABLE "UserWorkspace" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);

-- AlterTable: Invitation — rename invitedBy → invitedById, add revokedAt, add FK
ALTER TABLE "Invitation" RENAME COLUMN "invitedBy" TO "invitedById";
ALTER TABLE "Invitation" ALTER COLUMN "invitedById" DROP NOT NULL;
ALTER TABLE "Invitation" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
