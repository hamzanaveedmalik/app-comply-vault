-- AlterTable
ALTER TABLE "UserWorkspace" ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removedById" TEXT;

-- CreateIndex
CREATE INDEX "UserWorkspace_userId_removedAt_idx" ON "UserWorkspace"("userId", "removedAt");

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
