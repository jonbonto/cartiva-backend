import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OrderPaymentService } from '../payment.service'
import { AffiliateOrderIntegrationService } from '../../affiliate/integration/affiliate-order-integration.service'
import { MoneyValue } from '../../common/types/money'

/**
 * PHASE 6: AdminOrdersService
 * 
 * Responsibilities:
 * - List/search/filter orders
 * - Display order details
 * - Process refunds safely with audit trail
 * - Prevent financial integrity violations
 */
@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name)

  constructor(
    private prisma: PrismaService,
    private orderPaymentService: OrderPaymentService
    , private readonly affiliateOrderIntegrationService: AffiliateOrderIntegrationService
  ) {}

  /**
   * List orders with filtering and pagination
   */
  async listOrders(
    filters: { status?: string; provider?: string },
    sort: { by: 'createdAt' | 'paidAt' | 'status'; order: 'asc' | 'desc' },
    limit: number,
    offset: number
  ) {
    try {
      const where: any = {}

      // Filter by order status
      if (filters.status) {
        where.status = filters.status
      }

      // Filter by payment provider (requires joining payment table)
      const orders = await this.prisma.order.findMany({
        where,
        include: {
          items: true,
          payment: true,
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: {
          [sort.by]: sort.order,
        },
        take: limit,
        skip: offset,
      })

      // Filter by provider in memory (or could optimize with Prisma filter)
      const filtered = filters.provider
        ? orders.filter((o) => o.payment?.provider === filters.provider)
        : orders

      const total = await this.prisma.order.count({ where })

      return {
        items: filtered.map((order) => this.formatOrderForAdmin(order)),
        total,
        limit,
        offset,
      }
    } catch (error) {
      this.logger.error(`Failed to list orders: ${error.message}`)
      throw new InternalServerErrorException('Failed to list orders')
    }
  }

  /**
   * Get detailed order information
   */
  async getOrderDetail(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payment: true,
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      })

      if (!order) {
        throw new BadRequestException(`Order not found: ${orderId}`)
      }

      return this.formatOrderForAdmin(order)
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to get order detail: ${error.message}`)
      throw new InternalServerErrorException('Failed to get order detail')
    }
  }

  /**
   * Search orders by ID or email
   */
  async searchOrders(query: string) {
    try {
      // Search by order ID (exact match)
      if (query.startsWith('order_')) {
        const order = await this.prisma.order.findUnique({
          where: { id: query },
          include: {
            items: true,
            payment: true,
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        })

        if (order) {
          return [this.formatOrderForAdmin(order)]
        }
      }

      // Search by email (case-insensitive)
      const orders = await this.prisma.order.findMany({
        where: {
          user: {
            email: {
              contains: query.toLowerCase(),
              mode: 'insensitive',
            },
          },
        },
        include: {
          items: true,
          payment: true,
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        take: 50,
      })

      return orders.map((order) => this.formatOrderForAdmin(order))
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`)
      throw new InternalServerErrorException('Search failed')
    }
  }

  /**
   * Process refund for an order
   * 
   * Safety checks:
   * - Order must be PAID
   * - Partial refunds must not exceed original amount
   * - Refunds are idempotent
   */
  async refundOrder(
    orderId: string,
    reason?: string,
    amountCents?: number
  ) {
    try {
      // 1. Fetch order and payment
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true },
      })

      if (!order) {
        throw new BadRequestException(`Order not found: ${orderId}`)
      }

      if (order.status !== 'PAID') {
        throw new BadRequestException(
          `Cannot refund order with status: ${order.status}`
        )
      }

      if (!order.payment) {
        throw new BadRequestException(`No payment found for order: ${orderId}`)
      }

      if (order.payment.status !== 'paid') {
        throw new BadRequestException(
          `Payment is not in paid state: ${order.payment.status}`
        )
      }

      // 2. Validate refund amount
      let refundAmountCents = order.finalTotalAmountCents

      if (amountCents !== undefined) {
        if (amountCents <= 0) {
          throw new BadRequestException('Refund amount must be greater than 0')
        }

        if (amountCents > order.finalTotalAmountCents) {
          throw new BadRequestException(
            `Refund amount (${amountCents}) exceeds order total (${order.finalTotalAmountCents})`
          )
        }

        refundAmountCents = amountCents
      }

      // 3. Call payment provider to process refund
      const refundAmount = new MoneyValue(refundAmountCents, order.currency as any)

      const refundResult = await this.orderPaymentService.refundPaymentSafe(
        order.payment.providerPaymentId,
        order.payment.provider,
        refundAmount,
        reason
      )

      // 4. Create refund record (for audit trail)
      const refundRecord = await this.prisma.refund.create({
        data: {
          orderId,
          paymentId: order.payment.id,
          amountCents: refundAmountCents,
          reason: reason || 'Admin refund',
          status: 'REFUNDED',
          externalRefundId: refundResult.refundId,
          metadata: refundResult.metadata as any,
        },
      })

      // 5. Update order status if full refund
      const newStatus =
        refundAmountCents === order.finalTotalAmountCents
          ? 'REFUNDED'
          : 'PARTIAL_REFUNDED'

      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      })

      // Inform affiliate system (enqueue cancellation)
      try {
        if (newStatus === 'REFUNDED') {
          await this.affiliateOrderIntegrationService.handleRefundAsync(orderId, undefined, refundRecord.id, 'full_refund')
        } else {
          // Partial refund - enqueue generic refund handling (item-level cancellations require itemRefunds)
          await this.affiliateOrderIntegrationService.handleRefundAsync(orderId, undefined, refundRecord.id, 'partial_refund')
        }
      } catch (err) {
        this.logger.warn(`Failed to notify affiliate system about refund ${refundRecord.id} for order ${orderId}: ${err.message}`)
      }
      this.logger.log(
        `Refund processed: ${refundRecord.id} for order ${orderId}, amount: ${refundAmountCents}`
      )

      return {
        success: true,
        refundId: refundRecord.id,
        orderId,
        amountRefunded: refundAmount,
        newOrderStatus: newStatus,
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error

      this.logger.error(`Refund failed: ${error.message}`, error.stack)
      throw new InternalServerErrorException(`Refund failed: ${error.message}`)
    }
  }

  /**
   * Get refund history for an order (with item details)
   */
  async getRefundHistory(orderId: string) {
    try {
      const refunds = await this.prisma.refund.findMany({
        where: { orderId },
        include: {
          itemRefunds: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      return {
        orderId,
        refunds: refunds.map((r) => ({
          id: r.id,
          amountCents: r.amountCents,
          reason: r.reason,
          status: r.status,
          isPartial: r.isPartial,
          externalRefundId: r.externalRefundId,
          itemRefunds: r.itemRefunds.map((ir) => ({
            id: ir.id,
            orderItemId: ir.orderItemId,
            amountCents: ir.amountCents,
            quantity: ir.quantity,
          })),
          createdAt: r.createdAt,
        })),
      }
    } catch (error) {
      this.logger.error(`Failed to get refund history: ${error.message}`)
      throw new InternalServerErrorException('Failed to get refund history')
    }
  }

  /**
   * Format order for admin display
   */
  private formatOrderForAdmin(order: any) {
    return {
      id: order.id,
      userId: order.userId,
      userEmail: order.user?.email,
      userName: order.user?.name,
      currency: order.currency,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        subtotalCents: item.subtotalAmountCents,
      })),
      subtotalCents: order.subtotalAmountCents,
      discountsTotalCents: order.discountTotalAmountCents,
      taxCents: order.taxAmountCents,
      shippingCents: order.shippingCostCents,
      finalTotalCents: order.finalTotalAmountCents,
      status: order.status,
      payment: order.payment
        ? {
            id: order.payment.id,
            provider: order.payment.provider,
            status: order.payment.status,
            providerPaymentId: order.payment.providerPaymentId,
            createdAt: order.payment.createdAt,
            webhookReceivedAt: order.payment.webhookReceivedAt,
          }
        : null,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    }
  }
}
