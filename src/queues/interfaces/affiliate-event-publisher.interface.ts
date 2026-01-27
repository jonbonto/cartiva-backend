/**
 * AFFILIATE QUEUE INTERFACES — Job type definitions
 * 
 * Defines all job payloads for the affiliate queue.
 * These interfaces ensure type safety across producer and consumer.
 */

/**
 * Track affiliate click job
 */
export interface TrackAffiliateClickJob {
  referralCode: string
  productId: number
  sessionId: string
  ipAddress?: string
  userAgent?: string
  referer?: string
}

/**
 * Create affiliate commission job
 * Triggered when order is created with affiliated products
 */
export interface CreateAffiliateCommissionJob {
  affiliateId: string
  orderId: string
  orderItemId: string
  productId: number
  baseAmountCents: number
  commissionRate: number
  currency: string
  idempotencyKey: string
}

/**
 * Approve affiliate commission job
 * Triggered on order fulfillment completion
 */
export interface ApproveAffiliateCommissionJob {
  commissionId?: string  // Either commissionId
  orderId?: string       // Or orderId to approve all
}

/**
 * Cancel affiliate commission job
 * Triggered on refund or fraud detection
 */
export interface CancelAffiliateCommissionJob {
  commissionId?: string   // Specific commission
  orderId?: string        // All commissions for order
  orderItemId?: string    // All commissions for item
  reason: string
  refundId?: string
}

/**
 * Process payout batch job
 * Handles external payment processing
 */
export interface ProcessPayoutBatchJob {
  batchId: string
  affiliateId: string
  totalAmountCents: number
  currency: string
  paymentMethod: string
}

/**
 * Affiliate event publisher interface
 * Used by other modules to enqueue affiliate-related jobs
 */
export interface AffiliateEventPublisher {
  /**
   * Enqueue click tracking (fire and forget)
   */
  trackClick(data: TrackAffiliateClickJob): Promise<void>

  /**
   * Enqueue commission creation
   */
  createCommission(data: CreateAffiliateCommissionJob): Promise<void>

  /**
   * Enqueue commission approval
   */
  approveCommission(data: ApproveAffiliateCommissionJob): Promise<void>

  /**
   * Enqueue commission cancellation
   */
  cancelCommission(data: CancelAffiliateCommissionJob): Promise<void>

  /**
   * Enqueue payout processing
   */
  processPayoutBatch(data: ProcessPayoutBatchJob): Promise<void>
}
