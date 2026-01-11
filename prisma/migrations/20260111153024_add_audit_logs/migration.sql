-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "quantity" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "priceInCents" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
