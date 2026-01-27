-- CreateTable: Affiliate - Registered affiliate accounts
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "defaultCommissionRate" DECIMAL(5,4) NOT NULL,
    "payoutEmail" TEXT,
    "payoutMethod" TEXT,
    "payoutDetails" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AffiliateProductLink - Unique referral links per affiliate per product
CREATE TABLE "AffiliateProductLink" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "referralCode" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProductLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AffiliateClick - Tracks referral link clicks
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateProductLinkId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AffiliateCommission - Financial record of commissions (IMMUTABLE)
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "baseAmountCents" INTEGER NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "refundId" TEXT,
    "payoutBatchId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AffiliatePayoutBatch - Groups approved commissions for payment
CREATE TABLE "AffiliatePayoutBatch" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "commissionCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "initiatedBy" INTEGER,

    CONSTRAINT "AffiliatePayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Affiliate
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");
CREATE INDEX "Affiliate_userId_idx" ON "Affiliate"("userId");
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");
CREATE INDEX "Affiliate_createdAt_idx" ON "Affiliate"("createdAt");

-- CreateIndex: AffiliateProductLink
CREATE UNIQUE INDEX "AffiliateProductLink_referralCode_key" ON "AffiliateProductLink"("referralCode");
CREATE UNIQUE INDEX "AffiliateProductLink_affiliateId_productId_key" ON "AffiliateProductLink"("affiliateId", "productId");
CREATE INDEX "AffiliateProductLink_affiliateId_idx" ON "AffiliateProductLink"("affiliateId");
CREATE INDEX "AffiliateProductLink_productId_idx" ON "AffiliateProductLink"("productId");
CREATE INDEX "AffiliateProductLink_referralCode_idx" ON "AffiliateProductLink"("referralCode");
CREATE INDEX "AffiliateProductLink_isActive_idx" ON "AffiliateProductLink"("isActive");

-- CreateIndex: AffiliateClick
CREATE UNIQUE INDEX "AffiliateClick_affiliateProductLinkId_sessionId_key" ON "AffiliateClick"("affiliateProductLinkId", "sessionId");
CREATE INDEX "AffiliateClick_affiliateProductLinkId_idx" ON "AffiliateClick"("affiliateProductLinkId");
CREATE INDEX "AffiliateClick_sessionId_idx" ON "AffiliateClick"("sessionId");
CREATE INDEX "AffiliateClick_ipAddress_idx" ON "AffiliateClick"("ipAddress");
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");

-- CreateIndex: AffiliateCommission
CREATE UNIQUE INDEX "AffiliateCommission_idempotencyKey_key" ON "AffiliateCommission"("idempotencyKey");
CREATE INDEX "AffiliateCommission_affiliateId_idx" ON "AffiliateCommission"("affiliateId");
CREATE INDEX "AffiliateCommission_orderId_idx" ON "AffiliateCommission"("orderId");
CREATE INDEX "AffiliateCommission_orderItemId_idx" ON "AffiliateCommission"("orderItemId");
CREATE INDEX "AffiliateCommission_productId_idx" ON "AffiliateCommission"("productId");
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");
CREATE INDEX "AffiliateCommission_payoutBatchId_idx" ON "AffiliateCommission"("payoutBatchId");
CREATE INDEX "AffiliateCommission_createdAt_idx" ON "AffiliateCommission"("createdAt");

-- CreateIndex: AffiliatePayoutBatch
CREATE INDEX "AffiliatePayoutBatch_affiliateId_idx" ON "AffiliatePayoutBatch"("affiliateId");
CREATE INDEX "AffiliatePayoutBatch_status_idx" ON "AffiliatePayoutBatch"("status");
CREATE INDEX "AffiliatePayoutBatch_createdAt_idx" ON "AffiliatePayoutBatch"("createdAt");

-- AddForeignKey: Affiliate → User
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: AffiliateProductLink → Affiliate
ALTER TABLE "AffiliateProductLink" ADD CONSTRAINT "AffiliateProductLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AffiliateClick → AffiliateProductLink
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateProductLinkId_fkey" FOREIGN KEY ("affiliateProductLinkId") REFERENCES "AffiliateProductLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AffiliateCommission → Affiliate
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
