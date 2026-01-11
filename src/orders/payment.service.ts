import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersService } from './orders.service'
import { PaymentProvider, PaymentIntent, PaymentResult } from '../common/types/payment'
import { PaymentProviderRegistry } from '../common/types/payment'
import { StripePaymentProvider } from '../payments/stripe.provider'
import { MidtransPaymentProvider } from '../payments/midtrans.provider'
import { MockPaymentProvider } from '../common/types/payment-providers-impl'
import crypto from 'crypto'

/**
 * PHASE 5: OrderPaymentService
 * 
 * Responsibilities:
 * - Initiate payment for order
 * - Handle webhooks from payment providers
 * - Ensure idempotency
 * - Update order status based on payment events
 * - Never modify order or apply discounts (Order is immutable)
 * 
 * Principle: Payment events drive order status transitions
 */
@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name)
  private paymentProviderRegistry: PaymentProviderRegistry

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private stripeProvider: StripePaymentProvider,
    private midtransProvider: MidtransPaymentProvider
  ) {
    this.paymentProviderRegistry = new PaymentProviderRegistry()
    
    // Register payment providers
    this.paymentProviderRegistry.register(this.stripeProvider)
    this.paymentProviderRegistry.register(this.midtransProvider)
    this.paymentProviderRegistry.register(new MockPaymentProvider()) // For testing
    
    this.logger.log('Payment providers registered: stripe, midtrans, mock')
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): string[] {
    return this.paymentProviderRegistry.listProviders()
  }

  /**
   * Create payment intent for an order
   * 
   * - Validates order exists and status allows payment
   * - Delegates to provider to create payment intent
   * - Stores payment record for tracking
   * - Returns provider-normalized payment intent
   * 
   * @param orderId Order to create payment for
   * @param providerName Which payment provider to use
   * @returns PaymentIntent from provider
   */
  async createPayment(orderId: string, providerName: string): Promise<PaymentIntent> {
    // 1. Verify order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    })

    if (!order) {
      throw new BadRequestException(`Order not found: ${orderId}`)
    }

    // 2. Check order status allows payment
    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot create payment for order with status: ${order.status}`
      )
    }

    // 3. Check if payment already exists
    if (order.payment) {
      throw new BadRequestException(`Payment already exists for this order: ${order.payment.id}`)
    }

    // 4. Get provider
    let provider: PaymentProvider
    try {
      provider = this.paymentProviderRegistry.getProvider(providerName)
    } catch (error) {
      throw new BadRequestException(`Unknown payment provider: ${providerName}`)
    }

    // 5. Convert DB order to domain type
    const orderDomain = this.convertDbOrderToDomain(order)

    // 6. Create payment intent with provider
    let paymentIntent: PaymentIntent
    try {
      paymentIntent = await provider.createPayment(orderDomain)
      this.logger.log(
        `Payment intent created: ${paymentIntent.id} for order ${orderId} via ${providerName}`
      )
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent: ${error.message}`,
        error.stack
      )
      throw new InternalServerErrorException(
        `Payment provider error: ${error.message}`
      )
    }

    // 7. Store payment record
    try {
      await this.prisma.payment.create({
        data: {
          orderId,
          provider: providerName,
          providerPaymentId: paymentIntent.id,
          status: paymentIntent.status,
          idempotencyKey: this.generateIdempotencyKey(orderId, providerName),
        },
      })
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to store payment record: ${error.message}`
      )
    }

    // 8. Update order status to CHECKOUT
    await this.ordersService.updateOrderStatus(orderId, 'CHECKOUT')

    return paymentIntent
  }

  /**
   * Handle webhook from payment provider
   * 
   * Critical requirements:
   * - MUST be idempotent (same webhook twice = same result)
   * - MUST verify provider signature
   * - MUST update order status based on payment result
   * - MUST deduct stock only once
   * - MUST be transactional
   * 
   * @param providerName Payment provider name
   * @param rawPayload Raw webhook body
   * @param signature Provider's signature header
   */
  async handleWebhook(
    providerName: string,
    rawPayload: string | Buffer,
    signature: string
  ): Promise<{ acknowledged: boolean }> {
    this.logger.log(`Webhook received from ${providerName}`)

    // 1. Get provider
    let provider: PaymentProvider
    try {
      provider = this.paymentProviderRegistry.getProvider(providerName)
    } catch (error) {
      this.logger.warn(`Unknown provider in webhook: ${providerName}`)
      return { acknowledged: false }
    }

    // 2. Verify webhook signature
    try {
      const isValid = await provider.verifyWebhookSignature(rawPayload, signature)
      if (!isValid) {
        this.logger.warn(`Invalid webhook signature from ${providerName}`)
        return { acknowledged: false }
      }
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`)
      return { acknowledged: false }
    }

    // 3. Parse webhook payload
    let paymentResult: PaymentResult
    try {
      paymentResult = await provider.parseWebhookPayload(rawPayload)
    } catch (error) {
      this.logger.error(`Failed to parse webhook payload: ${error.message}`)
      return { acknowledged: false }
    }

    // 4. Check idempotency (prevent duplicate processing)
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentResult.intentId },
    })

    if (!payment) {
      this.logger.warn(`Payment not found for webhook: ${paymentResult.intentId}`)
      return { acknowledged: true } // Already processed or never existed
    }

    // If webhook already processed, return early (idempotent)
    if (
      payment.webhookReceivedAt &&
      payment.status === paymentResult.status
    ) {
      this.logger.log(`Webhook already processed (idempotent): ${paymentResult.intentId}`)
      return { acknowledged: true }
    }

    // 5. Update payment status
    try {
      await this.prisma.payment.update({
        where: { id: paymentResult.intentId },
        data: {
          status: paymentResult.status,
          rawWebhookPayload: paymentResult.metadata as any,
          webhookReceivedAt: new Date(),
        },
      })
    } catch (error) {
      this.logger.error(`Failed to update payment: ${error.message}`)
      throw new InternalServerErrorException('Failed to process webhook')
    }

    // 6. Update order status based on payment result
    try {
      const newOrderStatus = this.mapPaymentStatusToOrderStatus(paymentResult.status)

      if (newOrderStatus) {
        await this.ordersService.updateOrderStatus(payment.orderId, newOrderStatus)

        // 7. If payment succeeded, deduct stock
        if (paymentResult.status === 'paid') {
          await this.ordersService.deductStockForOrder(payment.orderId)
          this.logger.log(`Stock deducted for order: ${payment.orderId}`)
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to update order status: ${error.message}`,
        error.stack
      )
      throw new InternalServerErrorException('Failed to process payment result')
    }

    this.logger.log(
      `Webhook processed successfully: ${paymentResult.intentId} -> ${paymentResult.status}`
    )

    return { acknowledged: true }
  }

  /**
   * Check payment status with provider
   * Useful for manual reconciliation or async polling
   */
  async checkPaymentStatus(orderId: string): Promise<string> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    })

    if (!payment) {
      throw new BadRequestException(`No payment found for order: ${orderId}`)
    }

    const provider = this.paymentProviderRegistry.getProvider(payment.provider)
    const status = await provider.getPaymentStatus(payment.providerPaymentId)

    // Update local status if changed
    if (status !== payment.status) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status },
      })

      // Update order status if payment succeeded
      if (status === 'paid' && payment.status !== 'paid') {
        await this.ordersService.updateOrderStatus(orderId, 'PAID')
        await this.ordersService.deductStockForOrder(orderId)
      }
    }

    return status
  }

  /**
   * Refund a payment
   */
  async refundPayment(orderId: string, reason?: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    })

    if (!payment) {
      throw new BadRequestException(`No payment found for order: ${orderId}`)
    }

    if (payment.status !== 'paid') {
      throw new BadRequestException(
        `Cannot refund payment with status: ${payment.status}`
      )
    }

    const provider = this.paymentProviderRegistry.getProvider(payment.provider)

    try {
      const refundResult = await provider.refund(payment.providerPaymentId)

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          rawWebhookPayload: refundResult.metadata as any,
        },
      })

      await this.ordersService.updateOrderStatus(orderId, 'REFUNDED')

      this.logger.log(`Payment refunded: ${payment.providerPaymentId}`)
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`)
      throw new InternalServerErrorException(`Refund failed: ${error.message}`)
    }
  }

  /**
   * Helper: Convert DB order to domain Order type
   */
  private convertDbOrderToDomain(dbOrder: any) {
    const { MoneyValue } = require('../common/types/money')

    return {
      id: dbOrder.id,
      userId: dbOrder.userId?.toString(),
      currency: dbOrder.currency,
      items: dbOrder.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        pricePerUnitAtPurchase: new MoneyValue(item.unitPriceCents, dbOrder.currency),
        quantity: item.quantity,
        subtotal: new MoneyValue(item.subtotalAmountCents, dbOrder.currency),
      })),
      subtotal: new MoneyValue(dbOrder.subtotalAmountCents, dbOrder.currency),
      appliedDiscounts: dbOrder.appliedDiscounts || [],
      discountTotal: new MoneyValue(dbOrder.discountTotalAmountCents, dbOrder.currency),
      taxAmount: new MoneyValue(dbOrder.taxAmountCents, dbOrder.currency),
      shippingCost: new MoneyValue(dbOrder.shippingCostCents, dbOrder.currency),
      totalBeforePayment: new MoneyValue(
        dbOrder.totalBeforePaymentCents,
        dbOrder.currency
      ),
      finalTotal: new MoneyValue(dbOrder.finalTotalAmountCents, dbOrder.currency),
      createdAt: dbOrder.createdAt,
    }
  }

  /**
   * Helper: Map payment status to order status
   */
  private mapPaymentStatusToOrderStatus(paymentStatus: string): string | null {
    const mapping: Record<string, string> = {
      paid: 'PAID',
      failed: 'PAYMENT_FAILED',
      refunded: 'REFUNDED',
      cancelled: 'CANCELLED',
    }
    return mapping[paymentStatus] || null
  }

  /**
   * Generate idempotency key
   */
  private generateIdempotencyKey(orderId: string, providerName: string): string {
    return crypto
      .createHash('sha256')
      .update(`${orderId}:${providerName}`)
      .digest('hex')
  }
}
