import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { AdminOrdersService } from './admin-orders.service'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'
import { AdminGuard } from '../../auth/guards/admin.guard'

/**
 * PHASE 6: Admin Orders Controller
 * 
 * Responsibilities:
 * - View all orders with filtering & search
 * - View order details
 * - Process refunds safely
 * 
 * All endpoints require admin authentication
 */
@Controller('api/admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
  private readonly logger = new Logger(AdminOrdersController.name)

  constructor(private adminOrdersService: AdminOrdersService) {}

  /**
   * GET /api/admin/orders
   * List all orders with filters
   * 
   * Query params:
   * - status: PENDING|PAYMENT_FAILED|PAID|FULFILLED|CANCELLED
   * - provider: stripe|midtrans|mock
   * - sortBy: createdAt|paidAt|status
   * - sortOrder: asc|desc
   * - limit: 10-100 (default 20)
   * - offset: 0-...
   * 
   * Response:
   * {
   *   items: Order[]
   *   total: number
   *   limit: number
   *   offset: number
   * }
   */
  @Get()
  async listOrders(
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = Math.min(Math.max(parseInt(limit || '20'), 1), 100)
    const offsetNum = Math.max(parseInt(offset || '0'), 0)

    const filters = {
      status: status || undefined,
      provider: provider || undefined,
    }

    const sort = {
      by: (sortBy || 'createdAt') as 'createdAt' | 'paidAt' | 'status',
      order: (sortOrder || 'desc') as 'asc' | 'desc',
    }

    try {
      return await this.adminOrdersService.listOrders(
        filters,
        sort,
        limitNum,
        offsetNum
      )
    } catch (error) {
      this.logger.error(`Failed to list orders: ${error.message}`)
      throw error
    }
  }

  /**
   * GET /api/admin/orders/:id
   * Get detailed order information
   * 
   * Response:
   * {
   *   id: string
   *   userId: number | null
   *   userEmail: string | null
   *   currency: string
   *   items: OrderItem[]
   *   subtotal: Money
   *   discounts: AppliedDiscount[]
   *   discountTotal: Money
   *   tax: Money
   *   shipping: Money
   *   finalTotal: Money
   *   status: string
   *   payment: {
   *     id: string
   *     provider: string
   *     status: string
   *     providerPaymentId: string
   *     createdAt: Date
   *     rawWebhookPayload?: any
   *   }
   *   createdAt: Date
   *   paidAt: Date | null
   * }
   */
  @Get(':id')
  async getOrderDetail(@Param('id') orderId: string) {
    try {
      return await this.adminOrdersService.getOrderDetail(orderId)
    } catch (error) {
      this.logger.error(`Failed to get order detail: ${error.message}`)
      throw error
    }
  }

  /**
   * POST /api/admin/orders/search
   * Search orders by:
   * - Order ID
   * - User email
   * - User ID
   * 
   * Request:
   * {
   *   query: string (order ID or email)
   * }
   */
  @Post('search')
  async searchOrders(@Body() body: { query: string }) {
    if (!body.query || body.query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty')
    }

    try {
      return await this.adminOrdersService.searchOrders(body.query)
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`)
      throw error
    }
  }

  /**
   * POST /api/admin/orders/:id/refund
   * Process a refund for a paid order
   * 
   * Request:
   * {
   *   reason?: string (why refund is happening)
   *   amountCents?: number (for partial refunds, omit for full)
   * }
   * 
   * Response:
   * {
   *   success: true
   *   refundId: string
   *   orderId: string
   *   amountRefunded: Money
   *   newOrderStatus: string (should be REFUNDED or PARTIAL_REFUNDED)
   * }
   */
  @Post(':id/refund')
  async refundOrder(
    @Param('id') orderId: string,
    @Body() body: { reason?: string; amountCents?: number }
  ) {
    if (!orderId) {
      throw new BadRequestException('Order ID is required')
    }

    try {
      return await this.adminOrdersService.refundOrder(
        orderId,
        body.reason,
        body.amountCents
      )
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`)
      throw error
    }
  }

  /**
   * GET /api/admin/orders/:id/refunds
   * View refund history for an order
   */
  @Get(':id/refunds')
  async getRefundHistory(@Param('id') orderId: string) {
    try {
      return await this.adminOrdersService.getRefundHistory(orderId)
    } catch (error) {
      this.logger.error(`Failed to get refund history: ${error.message}`)
      throw error
    }
  }
}
