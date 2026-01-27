import { Processor, Process, OnQueueError, OnQueueFailed } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { AFFILIATE_QUEUE } from '../constants'
import {
  TrackAffiliateClickJob,
  CreateAffiliateCommissionJob,
  ApproveAffiliateCommissionJob,
  CancelAffiliateCommissionJob,
  ProcessPayoutBatchJob,
} from '../interfaces/affiliate-event-publisher.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Affiliate Queue Processor — Handles affiliate-related background jobs
 * 
 * Architecture:
 * - Each job handler is idempotent
 * - Financial operations wrapped in transactions
 * - Dead-letter logging for failed jobs
 * - Structured logging for audit trail
 * 
 * Job Types:
 * - track-click: Record click with deduplication
 * - create-commission: Create commission record
 * - approve-commission: Transition to approved status
 * - cancel-commission: Transition to cancelled status
 * - process-payout: External payment processing
 */
@Processor(AFFILIATE_QUEUE)
export class AffiliateQueueProcessor {
  private readonly logger = new Logger(AffiliateQueueProcessor.name)

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // CLICK TRACKING
  // ===========================================================================

  @Process('track-click')
  async handleTrackClick(job: Job<TrackAffiliateClickJob>): Promise<void> {
    const { referralCode, productId, sessionId, ipAddress, userAgent, referer } = job.data

    this.logger.debug(`Processing click tracking: ${referralCode}`)

    try {
      // Find the affiliate product link
      const link = await this.prisma.affiliateProductLink.findUnique({
        where: { referralCode },
        include: { affiliate: true },
      })

      if (!link) {
        this.logger.debug(`Referral code ${referralCode} not found - ignoring`)
        return
      }

      if (!link.isActive || link.affiliate.status !== 'active') {
        this.logger.debug(`Link or affiliate not active - ignoring`)
        return
      }

      if (link.productId !== productId) {
        this.logger.debug(`Product mismatch - ignoring`)
        return
      }

      // Create click (with unique constraint for deduplication)
      await this.prisma.affiliateClick.create({
        data: {
          affiliateProductLinkId: link.id,
          sessionId,
          ipAddress,
          userAgent,
          referer,
        },
      })

      this.logger.debug(`Click recorded for link ${link.id}`)
    } catch (error: any) {
      // Handle duplicate (unique constraint violation)
      if (error.code === 'P2002') {
        this.logger.debug(`Duplicate click for session ${sessionId} - ignoring`)
        return
      }
      throw error
    }
  }

  // ===========================================================================
  // COMMISSION CREATION
  // ===========================================================================

  @Process('create-commission')
  async handleCreateCommission(job: Job<CreateAffiliateCommissionJob>): Promise<void> {
    const data = job.data

    this.logger.log(`Processing commission creation: ${data.idempotencyKey}`)

    try {
      // Validate affiliate exists and is active
      const affiliate = await this.prisma.affiliate.findUnique({
        where: { id: data.affiliateId },
      })

      if (!affiliate) {
        this.logger.warn(`Affiliate ${data.affiliateId} not found - skipping commission`)
        return
      }

      if (affiliate.status !== 'active') {
        this.logger.warn(`Affiliate ${data.affiliateId} is ${affiliate.status} - skipping commission`)
        return
      }

      // Calculate commission amount
      const amountCents = Math.floor(data.baseAmountCents * data.commissionRate)

      // Create commission (idempotent via unique constraint on idempotencyKey)
      await this.prisma.affiliateCommission.create({
        data: {
          affiliateId: data.affiliateId,
          orderId: data.orderId,
          orderItemId: data.orderItemId,
          productId: data.productId,
          baseAmountCents: data.baseAmountCents,
          commissionRate: new Decimal(data.commissionRate),
          amountCents,
          currency: data.currency,
          status: 'pending',
          idempotencyKey: data.idempotencyKey,
        },
      })

      this.logger.log(
        `Commission created: ${amountCents} cents for order ${data.orderId} item ${data.orderItemId}`
      )
    } catch (error: any) {
      // Handle idempotency - commission already exists
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        this.logger.log(`Commission already exists for ${data.idempotencyKey} - idempotent success`)
        return
      }
      throw error
    }
  }

  // ===========================================================================
  // COMMISSION APPROVAL
  // ===========================================================================

  @Process('approve-commission')
  async handleApproveCommission(job: Job<ApproveAffiliateCommissionJob>): Promise<void> {
    const { commissionId, orderId } = job.data

    this.logger.log(`Processing commission approval: ${commissionId || `order ${orderId}`}`)

    try {
      if (commissionId) {
        // Approve single commission
        const commission = await this.prisma.affiliateCommission.findUnique({
          where: { id: commissionId },
        })

        if (!commission) {
          this.logger.warn(`Commission ${commissionId} not found`)
          return
        }

        if (commission.status !== 'pending') {
          this.logger.debug(`Commission ${commissionId} is ${commission.status} - skipping`)
          return
        }

        await this.prisma.affiliateCommission.update({
          where: { id: commissionId },
          data: {
            status: 'approved',
            approvedAt: new Date(),
          },
        })

        this.logger.log(`Commission ${commissionId} approved`)
      } else if (orderId) {
        // Approve all commissions for order
        const result = await this.prisma.affiliateCommission.updateMany({
          where: {
            orderId,
            status: 'pending',
          },
          data: {
            status: 'approved',
            approvedAt: new Date(),
          },
        })

        this.logger.log(`Approved ${result.count} commissions for order ${orderId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to approve commission: ${error.message}`)
      throw error
    }
  }

  // ===========================================================================
  // COMMISSION CANCELLATION
  // ===========================================================================

  @Process('cancel-commission')
  async handleCancelCommission(job: Job<CancelAffiliateCommissionJob>): Promise<void> {
    const { commissionId, orderId, orderItemId, reason, refundId } = job.data

    this.logger.log(`Processing commission cancellation: ${reason}`)

    try {
      const updateData = {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundId,
      }

      if (commissionId) {
        // Cancel single commission
        const commission = await this.prisma.affiliateCommission.findUnique({
          where: { id: commissionId },
        })

        if (!commission) {
          this.logger.warn(`Commission ${commissionId} not found`)
          return
        }

        if (!['pending', 'approved'].includes(commission.status)) {
          this.logger.debug(`Commission ${commissionId} is ${commission.status} - cannot cancel`)
          return
        }

        await this.prisma.affiliateCommission.update({
          where: { id: commissionId },
          data: updateData,
        })

        this.logger.log(`Commission ${commissionId} cancelled: ${reason}`)
      } else if (orderItemId) {
        // Cancel all commissions for order item
        const result = await this.prisma.affiliateCommission.updateMany({
          where: {
            orderItemId,
            status: { in: ['pending', 'approved'] },
          },
          data: updateData,
        })

        this.logger.log(`Cancelled ${result.count} commissions for item ${orderItemId}: ${reason}`)
      } else if (orderId) {
        // Cancel all commissions for order
        const result = await this.prisma.affiliateCommission.updateMany({
          where: {
            orderId,
            status: { in: ['pending', 'approved'] },
          },
          data: updateData,
        })

        this.logger.log(`Cancelled ${result.count} commissions for order ${orderId}: ${reason}`)
      }
    } catch (error) {
      this.logger.error(`Failed to cancel commission: ${error.message}`)
      throw error
    }
  }

  // ===========================================================================
  // PAYOUT PROCESSING
  // ===========================================================================

  @Process('process-payout')
  async handleProcessPayout(job: Job<ProcessPayoutBatchJob>): Promise<void> {
    const { batchId, affiliateId, totalAmountCents, currency, paymentMethod } = job.data

    this.logger.log(`Processing payout batch ${batchId}: ${totalAmountCents} ${currency}`)

    try {
      // Update batch to processing
      await this.prisma.affiliatePayoutBatch.update({
        where: { id: batchId },
        data: {
          status: 'processing',
          processedAt: new Date(),
        },
      })

      // TODO: Integrate with actual payment provider (PayPal, Stripe Connect, etc.)
      // For now, simulate payment processing
      this.logger.log(`Simulating ${paymentMethod} payout of ${totalAmountCents} cents to affiliate ${affiliateId}`)

      // In real implementation:
      // 1. Call payment provider API
      // 2. Wait for confirmation
      // 3. Update batch with payment reference

      // Simulate successful payment
      const paymentReference = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`

      await this.prisma.$transaction(async (tx) => {
        // Update batch to paid
        await tx.affiliatePayoutBatch.update({
          where: { id: batchId },
          data: {
            status: 'paid',
            paymentReference,
            paidAt: new Date(),
          },
        })

        // Update all commissions in batch to paid
        await tx.affiliateCommission.updateMany({
          where: { payoutBatchId: batchId },
          data: {
            status: 'paid',
            paidAt: new Date(),
          },
        })
      })

      this.logger.log(`Payout batch ${batchId} completed with reference ${paymentReference}`)
    } catch (error) {
      this.logger.error(`Payout processing failed for batch ${batchId}: ${error.message}`)

      // Mark batch as failed
      await this.prisma.$transaction(async (tx) => {
        await tx.affiliatePayoutBatch.update({
          where: { id: batchId },
          data: {
            status: 'failed',
            failedAt: new Date(),
            failureReason: error.message,
          },
        })

        // Remove batch association from commissions (so they can be retried)
        await tx.affiliateCommission.updateMany({
          where: { payoutBatchId: batchId },
          data: { payoutBatchId: null },
        })
      })

      throw error
    }
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`Queue error: ${error.message}`, error.stack)
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Job ${job.name} failed after ${job.attemptsMade} attempts: ${error.message}`,
      {
        jobId: job.id,
        jobName: job.name,
        data: job.data,
        error: error.message,
        stack: error.stack,
      },
    )

    // Log to dead-letter (could be external service in production)
    this.logToDeadLetter(job, error)
  }

  private logToDeadLetter(job: Job, error: Error): void {
    // In production, this would write to a dead-letter queue or external logging service
    this.logger.warn(`Dead letter: ${job.name}`, {
      jobId: job.id,
      data: JSON.stringify(job.data),
      error: error.message,
      failedAt: new Date().toISOString(),
    })
  }
}
