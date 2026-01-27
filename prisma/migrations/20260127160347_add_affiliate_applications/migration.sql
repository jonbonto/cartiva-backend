/*
  Warnings:

  - A unique constraint covering the columns `[userId,isDefault]` on the table `UserPaymentMethod` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,isDefault]` on the table `UserShippingAddress` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserPaymentMethod" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserShippingAddress" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AffiliateApplication" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "email" TEXT NOT NULL,
    "payoutMethod" TEXT,
    "payoutDetails" JSONB,
    "notes" TEXT,
    "adminNotes" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateApplication_userId_key" ON "AffiliateApplication"("userId");

-- CreateIndex
CREATE INDEX "AffiliateApplication_userId_idx" ON "AffiliateApplication"("userId");

-- CreateIndex
CREATE INDEX "AffiliateApplication_status_idx" ON "AffiliateApplication"("status");

-- CreateIndex
CREATE INDEX "AffiliateApplication_createdAt_idx" ON "AffiliateApplication"("createdAt");



-- AddForeignKey
ALTER TABLE "AffiliateApplication" ADD CONSTRAINT "AffiliateApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
