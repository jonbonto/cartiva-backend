import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { AFFILIATE_QUEUE } from '../constants'
import {
  AffiliateEventPublisher,
  TrackAffiliateClickJob,
  CreateAffiliateCommissionJob,
  ApproveAffiliateCommissionJob,
  CancelAffiliateCommissionJob,
  ProcessPayoutBatchJob,
} from '../interfaces/affiliate-event-publisher.interface'

/**
 * Affiliate Queue Service — Enqueues affiliate-related jobs
 * 
 * Implements the AffiliateEventPublisher interface so other modules
 * can depend on the interface instead of the concrete implementation.
 * 
 * Job naming convention:
 * - track-click
 * - create-commission
 * - approve-commission  
 * - cancel-commission
 * - process-payout
 */
@Injectable()
export class AffiliateQueueService implements AffiliateEventPublisher {
  private readonly logger = new Logger(AffiliateQueueService.name)

  constructor(
    @InjectQueue(AFFILIATE_QUEUE)
    private readonly affiliateQueue: Queue,
  ) {}

  /**
   * Track affiliate click (fire and forget)
   * Low priority - don't block user experience
   */
  async trackClick(data: TrackAffiliateClickJob): Promise<void> {
    try {
      await this.affiliateQueue.add(
        'track-click',
        data,
        {
          jobId: `click_${data.referralCode}_${data.sessionId}_${Date.now()}`,
          attempts: 2, // Clicks are low-priority
          backoff: { type: 'fixed', delay: 1000 },
          priority: 10, // Lower priority
        },
      )

      this.logger.debug(`Enqueued click tracking for ${data.referralCode}`)
    } catch (error) {
      // Don't throw - click tracking is non-critical
      this.logger.warn(`Failed to enqueue click tracking: ${error.message}`)
    }
  }

  /**
   * Create affiliate commission
   * High priority - must be processed reliably
   */
  async createCommission(data: CreateAffiliateCommissionJob): Promise<void> {
    try {
      await this.affiliateQueue.add(
        'create-commission',
        data,
        {
          // Idempotency key as job ID for deduplication
          jobId: `commission_${data.idempotencyKey}`,
          attempts: 5, // Financial operations need more retries
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          priority: 1, // High priority
        },
      )

      this.logger.log(`Enqueued commission creation for order ${data.orderId}, item ${data.orderItemId}`)
    } catch (error) {
      this.logger.error(`Failed to enqueue commission creation: ${error.message}`)
      throw error // Re-throw - commission creation is critical
    }
  }

  /**
   * Approve commission(s)
   * Medium priority - triggered by fulfillment
   */
  async approveCommission(data: ApproveAffiliateCommissionJob): Promise<void> {
    try {
      const jobId = data.commissionId
        ? `approve_${data.commissionId}_${Date.now()}`
        : `approve_order_${data.orderId}_${Date.now()}`

      await this.affiliateQueue.add(
        'approve-commission',
        data,
        {
          jobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 3,
        },
      )

      this.logger.log(`Enqueued commission approval: ${JSON.stringify(data)}`)
    } catch (error) {
      this.logger.error(`Failed to enqueue commission approval: ${error.message}`)
      throw error
    }
  }

  /**
   * Cancel commission(s)
   * High priority - refunds need fast processing
   */
  async cancelCommission(data: CancelAffiliateCommissionJob): Promise<void> {
    try {
      const jobId = data.commissionId
        ? `cancel_${data.commissionId}_${Date.now()}`
        : data.orderItemId
          ? `cancel_item_${data.orderItemId}_${Date.now()}`
          : `cancel_order_${data.orderId}_${Date.now()}`

      await this.affiliateQueue.add(
        'cancel-commission',
        data,
        {
          jobId,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 1, // High priority - refund related
        },
      )

      this.logger.log(`Enqueued commission cancellation: ${data.reason}`)
    } catch (error) {
      this.logger.error(`Failed to enqueue commission cancellation: ${error.message}`)
      throw error
    }
  }

  /**
   * Process payout batch
   * Medium priority - admin initiated
   */
  async processPayoutBatch(data: ProcessPayoutBatchJob): Promise<void> {
    try {
      await this.affiliateQueue.add(
        'process-payout',
        data,
        {
          jobId: `payout_${data.batchId}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          priority: 5,
        },
      )

      this.logger.log(`Enqueued payout processing for batch ${data.batchId}`)
    } catch (error) {
      this.logger.error(`Failed to enqueue payout processing: ${error.message}`)
      throw error
    }
  }

  /**
   * Bulk enqueue commission creation for an order
   * Convenience method for order integration
   */
  async createCommissionsForOrder(
    commissions: CreateAffiliateCommissionJob[],
  ): Promise<void> {
    for (const commission of commissions) {
      await this.createCommission(commission)
    }
  }
}
