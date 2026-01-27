import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { AffiliateQueueService } from './affiliate-queue.service'
import { AffiliateQueueProcessor } from './affiliate-queue.processor'
import { PrismaModule } from '../../prisma/prisma.module'
import { AFFILIATE_QUEUE } from '../constants'

/**
 * Affiliate Queue Module — Async job processing for affiliate system
 * 
 * Purpose:
 * - Track clicks asynchronously (don't block user)
 * - Create commissions reliably (with retries)
 * - Approve commissions on fulfillment
 * - Cancel commissions on refund
 * - Process payouts
 * 
 * Job Types:
 * - track-click: Record affiliate link click
 * - create-commission: Create commission record for order item
 * - approve-commission: Approve pending commissions
 * - cancel-commission: Cancel commissions (refund/fraud)
 * - process-payout: External payment processing
 * 
 * Reliability:
 * - All jobs have retry with exponential backoff
 * - Dead-letter logging for failed jobs
 * - Idempotent commission creation
 */

export const AFFILIATE_EVENT_PUBLISHER = 'AFFILIATE_EVENT_PUBLISHER'

@Module({
  imports: [
    BullModule.registerQueue({
      name: AFFILIATE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: false,   // Keep failed jobs for debugging
      },
    }),
    PrismaModule,
  ],
  providers: [
    AffiliateQueueService,
    AffiliateQueueProcessor,
    {
      provide: AFFILIATE_EVENT_PUBLISHER,
      useExisting: AffiliateQueueService,
    },
  ],
  exports: [AffiliateQueueService, AFFILIATE_EVENT_PUBLISHER],
})
export class AffiliateQueueModule {}
