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
} from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderPaymentService } from './payment.service'
import { CreateOrderDto } from './dto/order.dto'
import { JwtGuard } from '../auth/guards/jwt.guard'

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
    private orderPaymentService: OrderPaymentService
  ) {}

  /**
   * POST /api/orders/checkout
   * Create an order from cart
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
  @Post('checkout')
  async checkout(@Body() createOrderDto: CreateOrderDto) {
    if (!createOrderDto.cartId) {
      throw new BadRequestException('cartId is required')
    }

    if (!createOrderDto.currency) {
      throw new BadRequestException('currency is required')
    }

    try {
      const order = await this.ordersService.createOrderFromCart(
        createOrderDto.cartId,
        undefined, // Guest checkout for now
        createOrderDto
      )

      return {
        id: order.id,
        currency: order.currency,
        items: order.items,
        subtotal: order.subtotal,
        appliedDiscounts: order.appliedDiscounts,
        discountTotal: order.discountTotal,
        finalTotal: order.finalTotal,
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
   * Authentication optional (can view guest orders for 30 days)
   */
  @Get(':id')
  async getOrder(@Param('id') orderId: string, @Request() req?: any) {
    const userId = req?.user?.sub

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
  async createPayment(
    @Param('id') orderId: string,
    @Body() body: { provider: string }
  ) {
    if (!body.provider) {
      throw new BadRequestException('provider is required')
    }

    try {
      const paymentIntent = await this.orderPaymentService.createPayment(
        orderId,
        body.provider
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

    try {
      // Body might be raw buffer for signature verification
      const body = req.rawBody || JSON.stringify(req.body)

      const result = await this.orderPaymentService.handleWebhook(
        provider,
        body,
        signature
      )

      this.logger.log(`Webhook handled for ${provider}: acknowledged=${result.acknowledged}`)

      return { acknowledged: result.acknowledged }
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack)
      // Return 200 anyway to prevent provider from retrying
      return { acknowledged: false, error: error.message }
    }
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
  @UseGuards(JwtGuard)
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
}
