-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingProvider" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REFUNDED',
    "externalRefundId" TEXT,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRefund" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "ipAddress" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "orderId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "granularity" TEXT NOT NULL,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "paidOrderCount" INTEGER NOT NULL DEFAULT 0,
    "failedOrderCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrderCount" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "refundAmountCents" INTEGER NOT NULL DEFAULT 0,
    "partialRefundCount" INTEGER NOT NULL DEFAULT 0,
    "fullRefundCount" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValueCents" INTEGER NOT NULL DEFAULT 0,
    "providerBreakdown" JSONB,
    "shippedOrderCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredOrderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

-- CreateIndex
CREATE INDEX "ItemRefund_refundId_idx" ON "ItemRefund"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemRefund_refundId_orderItemId_key" ON "ItemRefund"("refundId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookLog_idempotencyKey_key" ON "WebhookLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookLog_provider_idx" ON "WebhookLog"("provider");

-- CreateIndex
CREATE INDEX "WebhookLog_status_idx" ON "WebhookLog"("status");

-- CreateIndex
CREATE INDEX "WebhookLog_orderId_idx" ON "WebhookLog"("orderId");

-- CreateIndex
CREATE INDEX "WebhookLog_paymentId_idx" ON "WebhookLog"("paymentId");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_nextRetryAt_idx" ON "WebhookLog"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookLog_provider_externalEventId_key" ON "WebhookLog"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_date_idx" ON "AnalyticsSnapshot"("date");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_granularity_idx" ON "AnalyticsSnapshot"("granularity");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_createdAt_idx" ON "AnalyticsSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_date_granularity_key" ON "AnalyticsSnapshot"("date", "granularity");

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_idx" ON "Order"("fulfillmentStatus");

-- AddForeignKey
ALTER TABLE "ItemRefund" ADD CONSTRAINT "ItemRefund_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
