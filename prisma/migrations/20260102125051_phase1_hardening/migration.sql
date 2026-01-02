/*
  Warnings:

  - You are about to drop the column `qty` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - Added the required column `quantity` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceInCents` to the `Product` table without a default value. This is not possible if the table is not empty.

*/

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_cartId_fkey";

-- AlterTable Product: Add priceInCents with default, migrate data, then drop price
ALTER TABLE "Product" ADD COLUMN "priceInCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" SET "priceInCents" = (CAST(CAST("price" AS numeric) * 100 AS integer)) WHERE "price" IS NOT NULL;
ALTER TABLE "Product" DROP COLUMN "price";

-- AlterTable CartItem: Add quantity with default, migrate data, then drop qty
ALTER TABLE "CartItem" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
UPDATE "CartItem" SET "quantity" = "qty" WHERE "qty" IS NOT NULL;
ALTER TABLE "CartItem" DROP COLUMN "qty";

-- AlterTable Cart: Add session TTL tracking
ALTER TABLE "Cart" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey with CASCADE
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
