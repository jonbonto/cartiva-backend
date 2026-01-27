/**
 * AFFILIATE ORDER INTEGRATION SERVICE
 * 
 * This service provides the interface between the affiliate system
 * and the order domain. It should be called by order-related code
 * at specific lifecycle points.
 * 
 * Integration Points:
 * 1. Order Creation → processOrderReferrals()
 * 2. Fulfillment Completion → approveOrderCommissions()
 * 3. Refund (Full) → handleFullRefund()
 * 4. Refund (Partial) → handleItemRefund()
 * 
 * Architecture:
 * - No direct DB writes to order tables
 * - Uses affiliate services internally
 * - Enqueues jobs for async processing
 * - All operations are idempotent
 */

import { Injectable, Logger, Inject } from '@nestjs/common'
import { AffiliateService } from '../services/affiliate.service'
import { AffiliateCommissionService } from '../services/affiliate-commission.service'
import { AFFILIATE_EVENT_PUBLISHER } from '../../queues/affiliate-queue/affiliate-queue.module'
import { AffiliateEventPublisher } from '../../queues/interfaces/affiliate-event-publisher.interface'
import { ReferralAttributionDto, CommissionResponseDto } from '../dto'

/**
 * Order item structure expected by this service
 */
export interface OrderItemForCommission {
  id: string
  productId: number
  subtotalAmountCents: number
  productName?: string
}

/**
 * Referral data structure (from checkout session)
 */
export interface CheckoutReferral {
  productId: number
  referralCode: string
}

@Injectable()
export class AffiliateOrderIntegrationService {
  private readonly logger = new Logger(AffiliateOrderIntegrationService.name)

  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly commissionService: AffiliateCommissionService,
    @Inject(AFFILIATE_EVENT_PUBLISHER)
    private readonly affiliateEventPublisher: AffiliateEventPublisher,
  ) {}

  // ===========================================================================
  // ORDER CREATION INTEGRATION
  // ===========================================================================

  /**
   * Process referrals during order creation
   * 
   * This should be called AFTER order items are saved to the database
   * but BEFORE the order creation transaction commits.
   * 
   * Flow:
   * 1. Resolve referrals to affiliates
   * 2. Filter out invalid attributions (self-purchase, inactive, etc.)
   * 3. Create commission records (pending status)
   * 
   * @param orderId The created order ID
   * @param buyerUserId The user making the purchase
   * @param orderItems Order items with pricing
   * @param referrals Product → referralCode mapping (from checkout session)
   * @param currency Order currency
   * @returns Created commissions (for logging/audit)
   */
  async processOrderReferrals(
    orderId: string,
    buyerUserId: number,
    orderItems: OrderItemForCommission[],
    referrals: Map<number, string>,
    currency: string,
  ): Promise<CommissionResponseDto[]> {
    this.logger.log(`Processing referrals for order ${orderId} (${referrals.size} referrals)`)

    if (referrals.size === 0) {
      this.logger.debug('No referrals to process')
      return []
    }

    // Step 1: Resolve referrals to attribution data
    const attributions = await this.affiliateService.resolveOrderReferrals(
      referrals,
      buyerUserId,
    )

    if (attributions.size === 0) {
      this.logger.debug('No valid attributions after resolution')
      return []
    }

    this.logger.log(`Resolved ${attributions.size} valid attributions`)

    // Step 2: Create commissions (sync for order integrity)
    // We create them synchronously to ensure they're part of the order flow
    const commissions = await this.commissionService.createCommissionsForOrder(
      orderId,
      attributions,
      orderItems.map(item => ({
        id: item.id,
        productId: item.productId,
        subtotalAmountCents: item.subtotalAmountCents,
      })),
      currency,
    )

    this.logger.log(`Created ${commissions.length} commissions for order ${orderId}`)

    return commissions
  }

  /**
   * Alternative: Async commission creation via queue
   * 
   * Use this if commission creation should not block order creation.
   * Less safe but better performance.
   */
  async processOrderReferralsAsync(
    orderId: string,
    buyerUserId: number,
    orderItems: OrderItemForCommission[],
    referrals: Map<number, string>,
    currency: string,
  ): Promise<void> {
    this.logger.log(`Queuing referral processing for order ${orderId}`)

    // Resolve referrals first (still sync)
    const attributions = await this.affiliateService.resolveOrderReferrals(
      referrals,
      buyerUserId,
    )

    // Enqueue commission creation jobs
    for (const item of orderItems) {
      const attribution = attributions.get(item.productId)
      if (!attribution) continue

      const idempotencyKey = `${orderId}:${item.id}:${attribution.affiliateId}`

      await this.affiliateEventPublisher.createCommission({
        affiliateId: attribution.affiliateId,
        orderId,
        orderItemId: item.id,
        productId: item.productId,
        baseAmountCents: item.subtotalAmountCents,
        commissionRate: attribution.commissionRate,
        currency,
        idempotencyKey,
      })
    }

    this.logger.log(`Enqueued commission creation for ${attributions.size} items`)
  }

  // ===========================================================================
  // FULFILLMENT INTEGRATION
  // ===========================================================================

  /**
   * Approve commissions when order is fulfilled/delivered
   * 
   * Call this when:
   * - Order fulfillment status → 'delivered'
   * - Or when payment is confirmed (depending on business rules)
   * 
   * @param orderId The fulfilled order ID
   */
  async approveOrderCommissions(orderId: string): Promise<number> {
    this.logger.log(`Approving commissions for fulfilled order ${orderId}`)

    const count = await this.commissionService.approveCommissionsForOrder(orderId)

    this.logger.log(`Approved ${count} commissions for order ${orderId}`)

    return count
  }

  /**
   * Async version: Enqueue approval job
   */
  async approveOrderCommissionsAsync(orderId: string): Promise<void> {
    this.logger.log(`Queuing commission approval for order ${orderId}`)

    await this.affiliateEventPublisher.approveCommission({ orderId })
  }

  // ===========================================================================
  // REFUND INTEGRATION
  // ===========================================================================

  /**
   * Handle full refund - cancel all commissions for order
   * 
   * @param orderId The refunded order ID
   * @param refundId The refund record ID (for audit trail)
   * @param reason Refund reason
   */
  async handleFullRefund(
    orderId: string,
    refundId: string,
    reason: string = 'full_refund',
  ): Promise<number> {
    this.logger.log(`Handling full refund for order ${orderId}`)

    const count = await this.commissionService.cancelCommissionsForOrder(
      orderId,
      reason,
      refundId,
    )

    this.logger.log(`Cancelled ${count} commissions for refunded order ${orderId}`)

    return count
  }

  /**
   * Handle partial refund - cancel commissions for specific items
   * 
   * @param orderId The order ID
   * @param orderItemId The refunded order item ID
   * @param refundId The refund record ID
   * @param reason Refund reason
   */
  async handleItemRefund(
    orderId: string,
    orderItemId: string,
    refundId: string,
    reason: string = 'partial_refund',
  ): Promise<number> {
    this.logger.log(`Handling item refund for order ${orderId}, item ${orderItemId}`)

    const count = await this.commissionService.cancelCommissionsForOrderItem(
      orderItemId,
      reason,
      refundId,
    )

    this.logger.log(`Cancelled ${count} commissions for refunded item ${orderItemId}`)

    return count
  }

  /**
   * Async version: Enqueue cancellation job
   */
  async handleRefundAsync(
    orderId: string,
    orderItemId: string | undefined,
    refundId: string,
    reason: string,
  ): Promise<void> {
    this.logger.log(`Queuing commission cancellation for refund`)

    await this.affiliateEventPublisher.cancelCommission({
      orderId: orderItemId ? undefined : orderId,
      orderItemId,
      reason,
      refundId,
    })
  }

  // ===========================================================================
  // FRAUD / ABUSE HANDLING
  // ===========================================================================

  /**
   * Cancel commissions due to suspected fraud
   * 
   * This should be called when fraud is detected on an order
   * or affiliate account.
   */
  async handleFraudDetection(
    orderId: string,
    reason: string = 'fraud_detected',
  ): Promise<number> {
    this.logger.warn(`Fraud detected - cancelling commissions for order ${orderId}`)

    const count = await this.commissionService.cancelCommissionsForOrder(
      orderId,
      reason,
    )

    this.logger.warn(`Cancelled ${count} commissions due to fraud on order ${orderId}`)

    return count
  }

  /**
   * Suspend affiliate and cancel all pending commissions
   */
  async handleAffiliateFraud(
    affiliateId: string,
    reason: string = 'affiliate_fraud',
  ): Promise<void> {
    this.logger.warn(`Affiliate fraud detected - suspending ${affiliateId}`)

    // Suspend the affiliate account (deactivates all links)
    await this.affiliateService.suspendAffiliate(affiliateId, reason)

    // Cancel all pending commissions
    // Note: This requires a new method in commission service
    // For now, we rely on the suspended status preventing payouts

    this.logger.warn(`Affiliate ${affiliateId} suspended for fraud`)
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Check if a product has any active affiliate links
   * Useful for displaying affiliate badge on product page
   */
  async hasActiveAffiliateLinks(productId: number): Promise<boolean> {
    const count = await this.affiliateService['prisma'].affiliateProductLink.count({
      where: {
        productId,
        isActive: true,
        affiliate: { status: 'active' },
      },
    })

    return count > 0
  }

  /**
   * Get attribution for a single referral code
   * Useful for real-time validation during checkout
   */
  async validateReferral(
    referralCode: string,
    productId: number,
    buyerUserId: number,
  ): Promise<ReferralAttributionDto | null> {
    return this.affiliateService.resolveReferral(
      referralCode,
      productId,
      buyerUserId,
    )
  }
}
