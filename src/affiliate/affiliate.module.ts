import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AffiliateQueueModule } from '../queues/affiliate-queue/affiliate-queue.module'

// Services
import { AffiliateService } from './services/affiliate.service'
import { AffiliateTrackingService } from './services/affiliate-tracking.service'
import { AffiliateCommissionService } from './services/affiliate-commission.service'

// Controllers
import {
  AffiliatePublicController,
  AffiliateController,
  AffiliateAdminController,
} from './affiliate.controller'

// Integration service
import { AffiliateOrderIntegrationService } from './integration/affiliate-order-integration.service'

/**
 * AFFILIATE MODULE — Product-Level Affiliate Program
 * 
 * This module implements a complete affiliate system with:
 * - Affiliate account management
 * - Per-product referral links
 * - Click tracking & attribution
 * - Commission calculation & lifecycle
 * - Payout management
 * 
 * Architecture:
 * - Clean separation from order domain
 * - Communication via service interface (not direct DB access)
 * - Async processing via Bull queue
 * - Idempotent operations for safety
 * 
 * Integration Points:
 * - Order creation: Call AffiliateOrderIntegrationService.processOrderReferrals()
 * - Fulfillment: Call AffiliateOrderIntegrationService.approveOrderCommissions()
 * - Refund: Call AffiliateOrderIntegrationService.handleRefund()
 * 
 * The module does NOT modify any existing order/payment code.
 * All integration is additive.
 */
@Module({
  imports: [
    PrismaModule,
    AffiliateQueueModule,
  ],
  controllers: [
    AffiliatePublicController,
    AffiliateController,
    AffiliateAdminController,
  ],
  providers: [
    AffiliateService,
    AffiliateTrackingService,
    AffiliateCommissionService,
    AffiliateOrderIntegrationService,
  ],
  exports: [
    // Export services for use by other modules (especially Orders)
    AffiliateService,
    AffiliateTrackingService,
    AffiliateCommissionService,
    AffiliateOrderIntegrationService,
    // Re-export queue module for convenience
    AffiliateQueueModule,
  ],
})
export class AffiliateModule {}
