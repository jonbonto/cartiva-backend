import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersService } from './orders.service'
import { InventoryReservationService } from '../services/inventory/inventory-reservation.service'
import { PaymentProvider, PaymentIntent, PaymentResult } from '../common/types/payment'
import { PaymentProviderRegistry } from '../common/types/payment'
import { StripePaymentProvider } from '../payments/stripe.provider'
import { MidtransPaymentProvider } from '../payments/midtrans.provider'
import { MockPaymentProvider } from '../common/types/payment-providers-impl'
import { EmailService } from '../email/email.service'
import { MoneyValue } from '../common/types/money'
import crypto from 'crypto'

/**
 * PHASE 6: OrderPaymentService (updated)
 * 
 * Responsibilities:
 * - Initiate payment for order
 * - Handle webhooks from payment providers
 * - Ensure idempotency
 * - Update order status based on payment events
 * - Handle inventory reservations (NEW - Phase 6)
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
    private inventoryReservationService: InventoryReservationService,
    private stripeProvider: StripePaymentProvider,
    private midtransProvider: MidtransPaymentProvider,
    private emailService: EmailService
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
        this.logger.warn(`Invalid webhook signature from ${providerName}, signature header: ${signature ? 'present' : 'missing'}`)
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
        const order = await this.prisma.order.findUnique({
          where: { id: payment.orderId },
          include: { items: true, user: true },
        })

        await this.ordersService.updateOrderStatus(payment.orderId, newOrderStatus)

        // 7. If payment succeeded, deduct stock and handle inventory reservations
        if (paymentResult.status === 'paid') {
          await this.ordersService.deductStockForOrder(payment.orderId)
          this.logger.log(`Stock deducted for order: ${payment.orderId}`)

          // Handle inventory reservations (Phase 6)
          await this.handleInventoryConfirmation(payment.orderId)

          // Send payment success email (async, don't block)
          if (order?.user?.email) {
            this.emailService
              .sendPaymentSuccess(
                order.user.email,
                payment.orderId,
                order.finalTotalAmountCents,
                order.currency,
                payment.provider,
                paymentResult.intentId
              )
              .catch((err) =>
                this.logger.error(`Failed to send payment success email: ${err.message}`)
              )
          }
        }

        // Send payment failure email if failed
        if (paymentResult.status === 'failed' && order?.user?.email) {
          // Handle inventory reservations - release them (Phase 6)
          await this.handleInventoryRelease(payment.orderId, 'PAYMENT_FAILED')

          this.emailService
            .sendPaymentFailure(
              order.user.email,
              payment.orderId,
              order.finalTotalAmountCents,
              paymentResult.metadata?.errorMessage as string | undefined
            )
            .catch((err) =>
              this.logger.error(`Failed to send payment failure email: ${err.message}`)
            )
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
    * Refund a payment (for AdminOrdersService)
    * Returns result for further processing
    */
   async refundPaymentSafe(
     paymentId: string,
     provider: string,
     amount?: MoneyValue,
     reason?: string
   ) {
     const paymentProvider = this.paymentProviderRegistry.getProvider(provider)

     try {
       const refundResult = await paymentProvider.refund(paymentId, amount)
       this.logger.log(`Refund processed: ${refundResult.refundId}`)
       return refundResult
     } catch (error) {
       this.logger.error(`Refund failed: ${error.message}`)
       throw error
     }
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

  /**
   * Handle inventory reservation confirmation after successful payment (Phase 6)
   * - Deduct reserved stock for each order item
   * - Mark reservations as CONFIRMED
   */
  private async handleInventoryConfirmation(orderId: string): Promise<void> {
    try {
      const orderWithReservations = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              reservation: true,
            },
          },
        },
      })

      if (!orderWithReservations) {
        this.logger.warn(`Order not found for inventory confirmation: ${orderId}`)
        return
      }

      // Process each item's reservation
      for (const item of orderWithReservations.items) {
        if (item.reservation) {
          try {
            await this.inventoryReservationService.deductReservedStock(item.reservation.id)
            this.logger.log(`✅ Inventory deducted for reservation ${item.reservation.id}`)
          } catch (error) {
            this.logger.error(
              `Failed to deduct inventory for reservation ${item.reservation.id}: ${error.message}`
            )
            // Don't fail the entire payment flow, but log the error
          }
        }
      }

      this.logger.log(`Inventory confirmations completed for order ${orderId}`)
    } catch (error) {
      this.logger.error(
        `Failed to handle inventory confirmation for order ${orderId}: ${error.message}`
      )
      // Don't throw - payment is already successful
    }
  }

  /**
   * Handle inventory reservation release on payment failure (Phase 6)
   * - Release all reservations for order items
   * - Restore reserved stock
   */
  private async handleInventoryRelease(
    orderId: string,
    reason: 'PAYMENT_FAILED' | 'EXPIRED' | 'MANUAL' = 'PAYMENT_FAILED'
  ): Promise<void> {
    try {
      const orderWithReservations = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              reservation: true,
            },
          },
        },
      })

      if (!orderWithReservations) {
        this.logger.warn(`Order not found for inventory release: ${orderId}`)
        return
      }

      // Release each item's reservation
      for (const item of orderWithReservations.items) {
        if (item.reservation) {
          try {
            await this.inventoryReservationService.releaseReservation(
              item.reservation.id,
              reason
            )
            this.logger.log(
              `✅ Inventory released for reservation ${item.reservation.id} (${reason})`
            )
          } catch (error) {
            this.logger.error(
              `Failed to release reservation ${item.reservation.id}: ${error.message}`
            )
            // Don't fail - just log
          }
        }
      }

      this.logger.log(`Inventory releases completed for order ${orderId}`)
    } catch (error) {
      this.logger.error(
        `Failed to handle inventory release for order ${orderId}: ${error.message}`
      )
      // Don't throw
    }
  }
}