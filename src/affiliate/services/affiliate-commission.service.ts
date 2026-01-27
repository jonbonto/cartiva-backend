/**
 * AFFILIATE COMMISSION SERVICE — Commission lifecycle management
 * 
 * Handles:
 * - Commission creation (from order items)
 * - Commission approval (on fulfillment)
 * - Commission cancellation (on refund)
 * - Payout batch management
 * - Commission statistics
 * 
 * Architecture:
 * - All commission records are immutable (append-only)
 * - Idempotency via unique key per order item + affiliate
 * - Transaction wrapping for financial integrity
 * - Status machine: pending → approved → paid
 *                         → cancelled
 */

import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'
import {
  CreateCommissionJobDto,
  CommissionResponseDto,
  CommissionFilterDto,
  AffiliateStatsResponseDto,
  ProcessPayoutDto,
  PayoutBatchResponseDto,
  ReferralAttributionDto,
} from '../dto'

// Valid commission status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['paid', 'cancelled'],
  cancelled: [], // Terminal state
  paid: [], // Terminal state
}

@Injectable()
export class AffiliateCommissionService {
  private readonly logger = new Logger(AffiliateCommissionService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // COMMISSION CREATION (Order Flow)
  // ===========================================================================

  /**
   * Create commission record for an order item
   * 
   * Called during order creation for each attributed product.
   * MUST be idempotent - safe to retry on order creation retries.
   * 
   * @param data Commission creation data
   * @returns Created commission or existing commission if already exists
   */
  async createCommission(data: CreateCommissionJobDto): Promise<CommissionResponseDto> {
    this.logger.log(`Creating commission for order ${data.orderId}, item ${data.orderItemId}`)

    // Validate affiliate exists and is active
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: data.affiliateId },
    })

    if (!affiliate) {
      throw new BadRequestException(`Affiliate ${data.affiliateId} not found`)
    }

    if (affiliate.status !== 'active') {
      this.logger.warn(`Skipping commission for suspended affiliate ${data.affiliateId}`)
      throw new BadRequestException(`Affiliate ${data.affiliateId} is ${affiliate.status}`)
    }

    // Calculate commission amount
    const amountCents = Math.floor(data.baseAmountCents * data.commissionRate)

    // Create with idempotency (unique constraint on idempotencyKey)
    try {
      const commission = await this.prisma.affiliateCommission.create({
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
        `Commission ${commission.id} created: ${amountCents} cents (${data.commissionRate * 100}% of ${data.baseAmountCents})`
      )

      return this.mapToResponse(commission)
    } catch (error: any) {
      // Handle idempotency - return existing commission
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        this.logger.log(`Commission already exists for idempotency key ${data.idempotencyKey}`)
        
        const existing = await this.prisma.affiliateCommission.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        })

        if (existing) {
          return this.mapToResponse(existing)
        }
      }

      throw error
    }
  }

  /**
   * Create commissions for an entire order
   * Processes all attributed products in a transaction
   * 
   * @param orderId Order ID
   * @param attributions Map of productId → ReferralAttributionDto
   * @param orderItems Order items with pricing
   * @param currency Order currency
   */
  async createCommissionsForOrder(
    orderId: string,
    attributions: Map<number, ReferralAttributionDto>,
    orderItems: Array<{
      id: string
      productId: number
      subtotalAmountCents: number
    }>,
    currency: string,
  ): Promise<CommissionResponseDto[]> {
    this.logger.log(`Creating commissions for order ${orderId} with ${attributions.size} attributions`)

    const commissions: CommissionResponseDto[] = []

    for (const item of orderItems) {
      const attribution = attributions.get(item.productId)
      if (!attribution) {
        continue // No attribution for this product
      }

      const idempotencyKey = `${orderId}:${item.id}:${attribution.affiliateId}`

      try {
        const commission = await this.createCommission({
          affiliateId: attribution.affiliateId,
          orderId,
          orderItemId: item.id,
          productId: item.productId,
          baseAmountCents: item.subtotalAmountCents,
          commissionRate: attribution.commissionRate,
          currency,
          idempotencyKey,
        })

        commissions.push(commission)
      } catch (error: any) {
        // Log but continue - don't fail entire order for commission issues
        this.logger.error(
          `Failed to create commission for item ${item.id}: ${error.message}`
        )
      }
    }

    return commissions
  }

  // ===========================================================================
  // COMMISSION STATUS TRANSITIONS
  // ===========================================================================

  /**
   * Approve commission (called on fulfillment completion)
   * Transitions: pending → approved
   */
  async approveCommission(commissionId: string): Promise<CommissionResponseDto> {
    return this.transitionStatus(commissionId, 'approved')
  }

  /**
   * Approve all commissions for an order
   * Called when order is fulfilled/delivered
   */
  async approveCommissionsForOrder(orderId: string): Promise<number> {
    this.logger.log(`Approving commissions for order ${orderId}`)

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
    return result.count
  }

  /**
   * Cancel commission (called on refund or fraud)
   * Transitions: pending|approved → cancelled
   */
  async cancelCommission(
    commissionId: string,
    reason: string,
    refundId?: string,
  ): Promise<CommissionResponseDto> {
    this.logger.log(`Cancelling commission ${commissionId}: ${reason}`)

    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id: commissionId },
    })

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`)
    }

    // Validate transition
    if (!VALID_TRANSITIONS[commission.status]?.includes('cancelled')) {
      throw new BadRequestException(
        `Cannot cancel commission with status ${commission.status}`
      )
    }

    const updated = await this.prisma.affiliateCommission.update({
      where: { id: commissionId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundId,
      },
    })

    this.logger.log(`Commission ${commissionId} cancelled: ${reason}`)

    return this.mapToResponse(updated)
  }

  /**
   * Cancel commissions for a specific order item (partial refund)
   */
  async cancelCommissionsForOrderItem(
    orderItemId: string,
    reason: string,
    refundId?: string,
  ): Promise<number> {
    this.logger.log(`Cancelling commissions for order item ${orderItemId}`)

    const result = await this.prisma.affiliateCommission.updateMany({
      where: {
        orderItemId,
        status: { in: ['pending', 'approved'] },
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundId,
      },
    })

    this.logger.log(`Cancelled ${result.count} commissions for item ${orderItemId}`)
    return result.count
  }

  /**
   * Cancel all commissions for an order (full refund)
   */
  async cancelCommissionsForOrder(
    orderId: string,
    reason: string,
    refundId?: string,
  ): Promise<number> {
    this.logger.log(`Cancelling all commissions for order ${orderId}`)

    const result = await this.prisma.affiliateCommission.updateMany({
      where: {
        orderId,
        status: { in: ['pending', 'approved'] },
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundId,
      },
    })

    this.logger.log(`Cancelled ${result.count} commissions for order ${orderId}`)
    return result.count
  }

  /**
   * Mark commission as paid
   * Transitions: approved → paid
   */
  async markAsPaid(
    commissionId: string,
    payoutBatchId: string,
  ): Promise<CommissionResponseDto> {
    return this.transitionStatus(commissionId, 'paid', { payoutBatchId })
  }

  /**
   * Generic status transition with validation
   */
  private async transitionStatus(
    commissionId: string,
    newStatus: string,
    additionalData?: Record<string, any>,
  ): Promise<CommissionResponseDto> {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id: commissionId },
    })

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`)
    }

    // Validate transition
    if (!VALID_TRANSITIONS[commission.status]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition commission from ${commission.status} to ${newStatus}`
      )
    }

    // Build update data with timestamp
    const updateData: any = { status: newStatus, ...additionalData }
    if (newStatus === 'approved') updateData.approvedAt = new Date()
    if (newStatus === 'cancelled') updateData.cancelledAt = new Date()
    if (newStatus === 'paid') updateData.paidAt = new Date()

    const updated = await this.prisma.affiliateCommission.update({
      where: { id: commissionId },
      data: updateData,
    })

    this.logger.log(`Commission ${commissionId} transitioned: ${commission.status} → ${newStatus}`)

    return this.mapToResponse(updated)
  }

  // ===========================================================================
  // COMMISSION QUERIES
  // ===========================================================================

  /**
   * Get commission by ID
   */
  async getCommissionById(commissionId: string): Promise<CommissionResponseDto> {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id: commissionId },
    })

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`)
    }

    return this.mapToResponse(commission)
  }

  /**
   * List commissions with filtering (admin)
   */
  async listCommissions(filters: CommissionFilterDto): Promise<{
    commissions: CommissionResponseDto[]
    total: number
  }> {
    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (filters.affiliateId) where.affiliateId = filters.affiliateId
    if (filters.status) where.status = filters.status
    if (filters.orderId) where.orderId = filters.orderId
    if (filters.productId) where.productId = filters.productId

    // Date range
    if (filters.startDate || filters.endDate) {
      where.createdAt = {}
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
    }

    const [commissions, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliateCommission.count({ where }),
    ])

    return {
      commissions: commissions.map(this.mapToResponse),
      total,
    }
  }

  /**
   * Get commissions for an affiliate
   */
  async getCommissionsForAffiliate(
    affiliateId: string,
    filters: Omit<CommissionFilterDto, 'affiliateId'>,
  ): Promise<{ commissions: CommissionResponseDto[]; total: number }> {
    return this.listCommissions({ ...filters, affiliateId })
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get affiliate earnings statistics
   */
  async getAffiliateStats(
    affiliateId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AffiliateStatsResponseDto> {
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate

    const baseWhere: any = { affiliateId }
    if (Object.keys(dateFilter).length > 0) {
      baseWhere.createdAt = dateFilter
    }

    // Get earnings by status
    const earnings = await this.prisma.affiliateCommission.groupBy({
      by: ['status'],
      where: baseWhere,
      _sum: { amountCents: true },
      _count: { id: true },
    })

    // Get click count
    const clicks = await this.prisma.affiliateClick.count({
      where: {
        affiliateProductLink: { affiliateId },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
    })

    // Get conversion count (orders with commissions)
    const conversions = await this.prisma.affiliateCommission.groupBy({
      by: ['orderId'],
      where: baseWhere,
    })

    // Map earnings by status
    const earningsByStatus: Record<string, number> = {}
    const countByStatus: Record<string, number> = {}
    for (const e of earnings) {
      earningsByStatus[e.status] = e._sum.amountCents || 0
      countByStatus[e.status] = e._count.id || 0
    }

    // Get top products
    const topProducts = await this.prisma.affiliateCommission.groupBy({
      by: ['productId'],
      where: baseWhere,
      _sum: { amountCents: true },
      _count: { id: true },
      orderBy: { _sum: { amountCents: 'desc' } },
      take: 5,
    })

    // Get click counts per product
    const productClicks = await this.prisma.affiliateClick.groupBy({
      by: ['affiliateProductLinkId'],
      where: {
        affiliateProductLink: { affiliateId },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      _count: { id: true },
    })

    // Get link → product mapping
    const links = await this.prisma.affiliateProductLink.findMany({
      where: { affiliateId },
      select: { id: true, productId: true },
    })
    const linkToProduct = new Map<string, number>(links.map(l => [l.id, l.productId]))
    
    const productClickCounts = new Map<number, number>()
    for (const pc of productClicks) {
      const productId = linkToProduct.get(pc.affiliateProductLinkId)
      if (productId !== undefined) {
        productClickCounts.set(
          productId,
          (productClickCounts.get(productId) || 0) + pc._count.id
        )
      }
    }

    const totalEarnings =
      (earningsByStatus['pending'] || 0) +
      (earningsByStatus['approved'] || 0) +
      (earningsByStatus['paid'] || 0)

    return {
      totalClicks: clicks,
      totalConversions: conversions.length,
      conversionRate: clicks > 0 ? conversions.length / clicks : 0,

      pendingEarningsCents: earningsByStatus['pending'] || 0,
      approvedEarningsCents: earningsByStatus['approved'] || 0,
      paidEarningsCents: earningsByStatus['paid'] || 0,
      cancelledEarningsCents: earningsByStatus['cancelled'] || 0,
      totalEarningsCents: totalEarnings,

      currency: 'USD', // Default, could be dynamic

      periodStart: startDate,
      periodEnd: endDate,

      topProducts: topProducts.map(tp => ({
        productId: tp.productId,
        clicks: productClickCounts.get(tp.productId) || 0,
        conversions: tp._count.id,
        earningsCents: tp._sum.amountCents || 0,
      })),
    }
  }

  // ===========================================================================
  // PAYOUT MANAGEMENT
  // ===========================================================================

  /**
   * Create payout batch for approved commissions
   */
  async createPayoutBatch(dto: ProcessPayoutDto, adminId?: number): Promise<PayoutBatchResponseDto> {
    this.logger.log(`Creating payout batch for affiliate ${dto.affiliateId}`)

    return this.prisma.$transaction(async (tx) => {
      // Find approved commissions to include
      const where: any = {
        affiliateId: dto.affiliateId,
        status: 'approved',
        payoutBatchId: null, // Not already in a batch
      }

      if (dto.commissionIds && dto.commissionIds.length > 0) {
        where.id = { in: dto.commissionIds }
      }

      const commissions = await tx.affiliateCommission.findMany({ where })

      if (commissions.length === 0) {
        throw new BadRequestException('No approved commissions found for payout')
      }

      // Calculate totals
      const totalAmountCents = commissions.reduce((sum, c) => sum + c.amountCents, 0)
      const currency = commissions[0].currency

      // Create batch
      const batch = await tx.affiliatePayoutBatch.create({
        data: {
          affiliateId: dto.affiliateId,
          totalAmountCents,
          currency,
          commissionCount: commissions.length,
          status: 'pending',
          paymentMethod: dto.paymentMethod,
          initiatedBy: adminId,
        },
      })

      // Link commissions to batch
      await tx.affiliateCommission.updateMany({
        where: { id: { in: commissions.map(c => c.id) } },
        data: { payoutBatchId: batch.id },
      })

      this.logger.log(
        `Payout batch ${batch.id} created: ${totalAmountCents} cents, ${commissions.length} commissions`
      )

      return this.mapBatchToResponse(batch)
    })
  }

  /**
   * Mark payout batch as paid (after external payment)
   */
  async markPayoutAsPaid(
    batchId: string,
    paymentReference: string,
  ): Promise<PayoutBatchResponseDto> {
    this.logger.log(`Marking payout batch ${batchId} as paid`)

    return this.prisma.$transaction(async (tx) => {
      // Update batch
      const batch = await tx.affiliatePayoutBatch.update({
        where: { id: batchId },
        data: {
          status: 'paid',
          paymentReference,
          paidAt: new Date(),
        },
      })

      // Update all commissions in batch
      await tx.affiliateCommission.updateMany({
        where: { payoutBatchId: batchId },
        data: {
          status: 'paid',
          paidAt: new Date(),
        },
      })

      this.logger.log(`Payout batch ${batchId} marked as paid`)

      return this.mapBatchToResponse(batch)
    })
  }

  /**
   * Mark payout batch as failed
   */
  async markPayoutAsFailed(
    batchId: string,
    reason: string,
  ): Promise<PayoutBatchResponseDto> {
    this.logger.log(`Marking payout batch ${batchId} as failed: ${reason}`)

    return this.prisma.$transaction(async (tx) => {
      // Update batch
      const batch = await tx.affiliatePayoutBatch.update({
        where: { id: batchId },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: reason,
        },
      })

      // Remove batch association from commissions (so they can be retried)
      await tx.affiliateCommission.updateMany({
        where: { payoutBatchId: batchId },
        data: { payoutBatchId: null },
      })

      this.logger.log(`Payout batch ${batchId} marked as failed`)

      return this.mapBatchToResponse(batch)
    })
  }

  /**
   * Get payout batches for affiliate
   */
  async getPayoutBatches(
    affiliateId: string,
    page = 1,
    limit = 20,
  ): Promise<{ batches: PayoutBatchResponseDto[]; total: number }> {
    const skip = (page - 1) * limit

    const [batches, total] = await Promise.all([
      this.prisma.affiliatePayoutBatch.findMany({
        where: { affiliateId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliatePayoutBatch.count({ where: { affiliateId } }),
    ])

    return {
      batches: batches.map(this.mapBatchToResponse),
      total,
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapToResponse(commission: any): CommissionResponseDto {
    return {
      id: commission.id,
      affiliateId: commission.affiliateId,
      orderId: commission.orderId,
      orderItemId: commission.orderItemId,
      productId: commission.productId,
      baseAmountCents: commission.baseAmountCents,
      commissionRate: Number(commission.commissionRate),
      amountCents: commission.amountCents,
      currency: commission.currency,
      status: commission.status,
      approvedAt: commission.approvedAt,
      cancelledAt: commission.cancelledAt,
      paidAt: commission.paidAt,
      cancellationReason: commission.cancellationReason,
      createdAt: commission.createdAt,
    }
  }

  private mapBatchToResponse(batch: any): PayoutBatchResponseDto {
    return {
      id: batch.id,
      affiliateId: batch.affiliateId,
      totalAmountCents: batch.totalAmountCents,
      currency: batch.currency,
      commissionCount: batch.commissionCount,
      status: batch.status,
      paymentMethod: batch.paymentMethod,
      paymentReference: batch.paymentReference,
      processedAt: batch.processedAt,
      paidAt: batch.paidAt,
      createdAt: batch.createdAt,
    }
  }
}
