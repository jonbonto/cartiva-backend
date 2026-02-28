import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  Headers,
  Req,
  Inject,
} from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderPaymentService } from './payment.service'
import { CreateOrderDto } from './dto/order.dto'
import { JwtAuthGuard } from '../auth/guards/jwt.guard'
import { CreateOrderUseCase } from './application/create-order.usecase'
import { CancelOrderUseCase } from './application/cancel-order.usecase'
import { GetOrderQuery } from './application/get-order.query'
import { GetCustomerOrdersQuery } from './application/get-customer-orders.query'
import { FeatureFlagsService, FeatureFlag } from '../feature-flags/feature-flags.service'
import { UsersService } from '../users/users.service'

/**
 * PHASE 5: Orders Controller
 * 
 * API Endpoints:
 * POST   /api/orders/checkout         - Create order from cart
 * GET    /api/orders/:id              - Get order details (authenticated)
 * POST   /api/orders/:id/payment      - Create payment for order
 * POST   /api/webhooks/:provider      - Payment provider webhook
 * GET    /api/orders/:id/status       - Check payment status
 * POST   /api/orders/:id/refund       - Refund a payment
 */
@Controller('api/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name)

  constructor(
    private ordersService: OrdersService,
    private orderPaymentService: OrderPaymentService,
    private createOrderUseCase: CreateOrderUseCase,
    private cancelOrderUseCase: CancelOrderUseCase,
    private getOrderQuery: GetOrderQuery,
    private getCustomerOrdersQuery: GetCustomerOrdersQuery,
    private featureFlags: FeatureFlagsService,
    private usersService: UsersService,
  ) {}

  /**
   * POST /api/orders/checkout
   * Create an order from cart
   * 
   * Required: User must be authenticated
   * 
   * Request:
   * {
   *   cartId: number
   *   currency: 'USD' | 'EUR' | etc.
   *   discountCodes?: string[]
   * }
   * 
   * Response:
   * {
   *   id: string
   *   items: OrderItem[]
   *   subtotal: Money
   *   appliedDiscounts: AppliedDiscount[]
   *   finalTotal: Money
   *   createdAt: Date
   * }
   */
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Body() createOrderDto: CreateOrderDto, @Request() req: any) {
    if (!createOrderDto.cartId) {
      throw new BadRequestException('cartId is required')
    }

    if (!createOrderDto.currency) {
      throw new BadRequestException('currency is required')
    }

    // Extract userId from JWT token
    const userId = req.user?.id
    if (!userId) {
      throw new BadRequestException('User ID not found in token')
    }

    try {
      const body: any = createOrderDto as any

      // If saved-address-at-checkout feature is enabled and a shippingAddressId
      // was provided, resolve the saved address from UsersService and map it
      // into the address shape expected by the CreateOrderUseCase.
      let resolvedAddress = body.shippingAddress || body.address

      if (
        body.shippingAddressId &&
        this.featureFlags.isEnabled(FeatureFlag.USER_SAVED_ADDRESSES_AT_CHECKOUT) &&
        this.usersService
      ) {
        const saved = await this.usersService.getAddress(Number(userId), body.shippingAddressId)
        if (!saved) {
          throw new BadRequestException('Saved shipping address not found')
        }

        resolvedAddress = {
          country: saved.country,
          state: saved.stateProvince || (saved as any).state || undefined,
          city: saved.city,
          postalCode: saved.postalCode,
        }
      }
      // If feature is enabled but UsersService is not available in the DI context,
      // we silently ignore saved address resolution to keep test modules simple.

      const order = await this.createOrderUseCase.execute({
        userId,
        currency: createOrderDto.currency,
        cartId: createOrderDto.cartId,
        items: body.items || [],
        address: resolvedAddress,
        shippingMethodId: createOrderDto.shippingMethodId,
        discountCodes: createOrderDto.discountCodes,
      })
      const finalTotalAmountCents = order.calculateTotal()
      return {
        id: order.id,
        currency: order.currency,
        items: order.items,
        subtotal: order.subtotalCents,
        taxCents: order.taxCents,
        shippingCents: order.shippingCents,
        finalTotalAmountCents,
        finalTotal: finalTotalAmountCents / 100,
        createdAt: order.createdAt,
      }
    } catch (error) {
      this.logger.error(`Checkout failed: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * GET /api/orders/:id
   * Get order details
   * Authentication required - users can only view their own orders
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOrder(@Param('id') orderId: string, @Request() req: any) {
    const userId = req.user?.id

    try {
      const order = await this.ordersService.getOrderById(orderId, userId)
      return {
        id: order.id,
        userId: order.userId,
        currency: order.currency,
        items: order.items,
        subtotal: order.subtotalAmountCents,
        discountTotal: order.discountTotalAmountCents,
        finalTotal: order.finalTotalAmountCents,
        status: order.status,
        payment: order.payment
          ? {
              id: order.payment.id,
              provider: order.payment.provider,
              status: order.payment.status,
            }
          : null,
        createdAt: order.createdAt,
      }
    } catch (error) {
      this.logger.error(`Failed to get order: ${error.message}`)
      throw error
    }
  }

  /**
   * POST /api/orders/:id/payment
   * Create payment for an order
   * 
   * Request:
   * {
   *   provider: 'stripe' | 'midtrans' | 'paypal'
   * }
   * 
   * Response (provider-dependent):
   * For Stripe (embedded):
   * {
   *   id: string
   *   clientSecret: string
   *   amount: Money
   * }
   * 
   * For Midtrans (redirect):
   * {
   *   id: string
   *   redirectUrl: string
   *   amount: Money
   * }
   */
  @Post(':id/payment')
  @UseGuards(JwtAuthGuard)
  async createPayment(
    @Param('id') orderId: string,
    @Body() body: { provider: string; paymentMethodId?: string },
    @Request() req: any
  ) {
    if (!body.provider) {
      throw new BadRequestException('provider is required')
    }

    try {
      let options: any = undefined

      // If caller supplied a saved payment method id, resolve it via UsersService
      if (body.paymentMethodId) {
        if (!this.usersService) {
          throw new BadRequestException('UsersService not available to resolve saved payment methods')
        }

        // Fetch order to verify ownership
        const order = await this.ordersService.getOrderById(orderId)
        const orderOwnerId = Number(order.userId)

        const callerUserId = req.user?.id
        if (!callerUserId) {
          throw new BadRequestException('Authentication required to use saved payment method')
        }

        if (Number(callerUserId) !== Number(orderOwnerId)) {
          throw new BadRequestException('Cannot use saved payment method for another user\'s order')
        }

        const pm = await this.usersService.getPaymentMethod(orderOwnerId, body.paymentMethodId)
        if (!pm) {
          throw new BadRequestException('Payment method not found')
        }

        if (!(pm as any).canBeUsed?.()) {
          // If entity doesn't expose canBeUsed, fall back to basic active check
          if (!(pm as any).isActive) {
            throw new BadRequestException('Payment method is not active')
          }
        }

        options = { paymentMethodToken: pm.providerTokenId }
      }

      const paymentIntent = await this.orderPaymentService.createPayment(
        orderId,
        body.provider,
        options,
      )

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        redirectUrl: paymentIntent.redirectUrl || undefined,
        clientSecret: paymentIntent.clientSecret || undefined,
        expiresAt: paymentIntent.expiresAt,
      }
    } catch (error) {
      this.logger.error(`Payment creation failed: ${error.message}`)
      throw error
    }
  }

  /**
   * GET /api/orders/:id/tracking (Customer Tracking - PHASE 7)
   * Get order tracking information (public endpoint for customers)
   * 
   * Response:
   * {
   *   orderId: string
   *   fulfillmentStatus: string
   *   shippingProvider?: string
   *   trackingNumber?: string
   *   timeline: Array<{status, timestamp, completed}>
   * }
   */
  @Get(':id/tracking')
  async getOrderTracking(@Param('id') orderId: string) {
    try {
      const order = await this.ordersService.getOrderById(orderId)

      // Build timeline using order timestamps
      const timeline: Array<any> = []

      timeline.push({
        status: 'created',
        label: 'Order Created',
        timestamp: order.createdAt,
        completed: true,
      })

      if ((order as any).paidAt) {
        timeline.push({
          status: 'paid',
          label: 'Payment Confirmed',
          timestamp: (order as any).paidAt,
          completed: true,
        })
      }

      const fulfillmentStatus = (order as any).fulfillmentStatus

      timeline.push({
        status: 'processing',
        label: 'Processing',
        timestamp: null,
        completed: ['processing', 'shipped', 'delivered'].includes(
          fulfillmentStatus,
        ),
      })

      if ((order as any).shippedAt || fulfillmentStatus === 'shipped') {
        timeline.push({
          status: 'shipped',
          label: 'Shipped',
          timestamp: (order as any).shippedAt,
          completed: true,
        })
      }

      if ((order as any).deliveredAt || fulfillmentStatus === 'delivered') {
        timeline.push({
          status: 'delivered',
          label: 'Delivered',
          timestamp: (order as any).deliveredAt,
          completed: fulfillmentStatus === 'delivered',
        })
      }

      if (fulfillmentStatus === 'cancelled') {
        timeline.push({
          status: 'cancelled',
          label: 'Cancelled',
          timestamp: null,
          completed: true,
        })
      }

      return {
        success: true,
        data: {
          orderId: order.id,
          orderStatus: order.status,
          fulfillmentStatus: fulfillmentStatus,
          shippingProvider: (order as any).shippingProvider,
          trackingNumber: (order as any).trackingNumber,
          timeline,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to get tracking: ${error.message}`)
      throw error
    }
  }

  /**
   * POST /api/webhooks/:provider
   * Handle payment provider webhook
   * 
   * Important: This endpoint should:
   * - NOT verify JWT (provider doesn't send auth)
   * - Verify provider signature instead
   * - Be idempotent
   * - Always return 200 OK if processed
   * 
   * Signature header varies by provider:
   * - Stripe: x-stripe-signature
   * - Midtrans: x-midtrans-signature
   * - PayPal: paypal-transmission-sig
   */
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<any>,
    @Headers('x-stripe-signature') stripeSignature?: string,
    @Headers('x-midtrans-signature') midtransSignature?: string,
    @Headers('paypal-transmission-sig') paypalSignature?: string
  ) {
    const signature = stripeSignature || midtransSignature || paypalSignature || ''

    this.logger.log(`🔔 WEBHOOK RECEIVED - Provider: ${provider}`)
    this.logger.log(`   Signature Header Present: ${!!signature}`)
    this.logger.log(`   Raw Body Available: ${!!req.rawBody}`)

    // Validate that raw body is available for signature verification
    if (!req.rawBody && !req.body) {
      this.logger.error('Webhook rejected: raw body not available for signature verification')
      return { acknowledged: false, error: 'Raw body not available' }
    }

    // Reject stale webhooks to prevent replay attacks (checks Stripe-format timestamp)
    if (signature && this.isWebhookStale(signature)) {
      this.logger.warn(`Webhook rejected: stale timestamp detected for provider ${provider}`)
      return { acknowledged: false, error: 'Webhook timestamp is too old' }
    }

    try {
      // Body might be raw buffer for signature verification
      const body = req.rawBody || JSON.stringify(req.body)

      this.logger.log(`   Processing webhook with payload of ${typeof body === 'string' ? body.length : (body as Buffer).length} bytes`)

      const result = await this.orderPaymentService.handleWebhook(
        provider,
        body,
        signature
      )

      this.logger.log(`✅ Webhook handled for ${provider}: acknowledged=${result.acknowledged}`)

      return { acknowledged: result.acknowledged }
    } catch (error) {
      this.logger.error(`❌ Webhook processing error: ${error.message}`, error.stack)
      // Return 200 anyway to prevent provider from retrying
      return { acknowledged: false, error: error.message }
    }
  }

  /**
   * Check if a webhook signature timestamp is stale (replay attack prevention).
   * Supports Stripe-format signatures: "t=<unix_timestamp>,v1=<hash>"
   * Returns false (not stale) if no timestamp can be found in the signature.
   */
  private isWebhookStale(signature: string, toleranceSeconds = 300): boolean {
    const match = signature.match(/t=(\d+)/)
    if (!match) return false
    const webhookTimestamp = parseInt(match[1], 10)
    const now = Math.floor(Date.now() / 1000)
    return (now - webhookTimestamp) > toleranceSeconds
  }

  /**
   * GET /api/orders/:id/status
   * Check payment status (useful for polling)
   */
  @Get(':id/status')
  async getPaymentStatus(@Param('id') orderId: string) {
    try {
      const status = await this.orderPaymentService.checkPaymentStatus(orderId)
      return { status }
    } catch (error) {
      this.logger.error(`Failed to check payment status: ${error.message}`)
      throw error
    }
  }

  /**
   * POST /api/orders/:id/refund
   * Refund a payment
   * Requires authentication
   */
  @Post(':id/refund')
  @UseGuards(JwtAuthGuard)
  async refundPayment(
    @Param('id') orderId: string,
    @Body() body: { reason?: string },
    @Request() req: any
  ) {
    try {
      await this.orderPaymentService.refundPayment(orderId, body.reason)
      return { success: true, message: 'Payment refunded' }
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`)
      throw error
    }
  }

  /**
   * GET /api/orders (Customer Order History - PHASE 7)
   * Get customer's own orders with pagination
   * 
   * Query Params:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * - status: string (optional filter)
   * - sortBy: 'createdAt' | 'paidAt' (default: 'createdAt')
   * - sortOrder: 'asc' | 'desc' (default: 'desc')
   * 
   * Authentication: Required (JWT)
   * 
   * Response:
   * {
   *   data: Order[]
   *   pagination: { page, limit, total, totalPages }
   * }
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getCustomerOrders(@Request() req: any, @Req() request: any) {
    const userId = req.user.id
    const page = parseInt(request.query.page as string) || 1
    const limit = Math.min(parseInt(request.query.limit as string) || 20, 100)
    const status = request.query.status as string
    const sortBy = (request.query.sortBy as string) || 'createdAt'
    const sortOrder = (request.query.sortOrder as 'asc' | 'desc') || 'desc'

    try {
      const result = await this.ordersService.getCustomerOrders({
        userId,
        page,
        limit,
        status,
        sortBy,
        sortOrder,
      })

      return {
        success: true,
        data: result.orders,
        pagination: result.pagination,
      }
    } catch (error) {
      this.logger.error(`Failed to fetch customer orders: ${error.message}`)
      throw error
    }
  }

  /**
   * POST /api/orders/:id/cancel
   * Cancel an order (user must own the order)
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(@Param('id') orderId: string, @Request() req: any) {
    const userId = req.user?.id

    try {
      const order = await this.cancelOrderUseCase.execute({ orderId, userId })
      return { success: true, id: order.id, status: order.status }
    } catch (error) {
      this.logger.error(`Cancel failed: ${error.message}`)
      throw error
    }
  }
}
