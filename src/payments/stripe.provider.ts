/**
 * PHASE 5.1: Stripe Payment Provider
 * 
 * Production-grade Stripe integration using Payment Intents API.
 * Supports embedded checkout with client secret for frontend payment.
 * 
 * Security:
 * - Webhook signature verification
 * - No price calculation in frontend
 * - Idempotent payment creation
 */

import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import Stripe from 'stripe'
import { 
  PaymentProvider, 
  PaymentIntent, 
  PaymentResult, 
  RefundResult, 
  PaymentStatus 
} from '../common/types/payment'
import { Order } from '../common/types/order'
import { MoneyValue } from '../common/types/money'
import { Logger } from '@nestjs/common'

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe'
  private readonly logger = new Logger(StripePaymentProvider.name)
  private readonly stripe: Stripe
  private readonly webhookSecret: string

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not set in environment')
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not set in environment')
    }

    this.stripe = new Stripe(apiKey)
    this.webhookSecret = webhookSecret
  }

  /**
   * Create a Stripe payment intent from order
   * 
   * - Uses order total in cents
   * - Attaches metadata for webhook reconciliation
   * - Returns client secret for frontend embedded checkout
   */
  async createPayment(order: Order): Promise<PaymentIntent> {
    try {
      // Stripe expects amount in cents, currency in lowercase
      const amountCents = order.finalTotal.amountCents
      const currency = order.finalTotal.currency.toLowerCase()

      // Create payment intent with idempotency key (order ID)
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency,
          description: `Order ${order.id}`,
          metadata: {
            orderId: order.id,
            userId: order.userId || 'guest',
            itemCount: order.items.length.toString(),
          },
          // Allow manual confirmation for webhook handling
          confirm: false,
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          idempotencyKey: `order_${order.id}`,
        }
      )

      this.logger.log(`Payment intent created: ${intent.id} for order ${order.id}`)

      return {
        id: intent.id,
        orderId: order.id,
        status: this.mapStripeStatusToNormalized(intent.status),
        amount: order.finalTotal,
        createdAt: new Date(intent.created * 1000),
        expiresAt: new Date((intent.created + 900) * 1000), // 15 minutes
        clientSecret: intent.client_secret || undefined,
        metadata: {
          stripeIntentId: intent.id,
          stripeStatus: intent.status,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to create Stripe payment intent: ${error.message}`)
      throw new InternalServerErrorException(
        `Payment provider error: ${error.message}`
      )
    }
  }

  /**
   * Verify Stripe webhook signature
   * 
   * Critical for security - ensures webhook is from Stripe
   * Requires raw request body (not parsed JSON) for signature verification
   */
  async verifyWebhookSignature(
    rawPayload: string | Buffer,
    signature: string
  ): Promise<boolean> {
    try {
      if (!signature) {
        this.logger.warn('Webhook verification failed: No stripe-signature header provided')
        return false
      }

      if (!this.webhookSecret) {
        this.logger.error('Webhook verification failed: STRIPE_WEBHOOK_SECRET not configured')
        return false
      }

      // Stripe requires the raw request body as string or Buffer
      const payload = typeof rawPayload === 'string' 
        ? rawPayload 
        : rawPayload.toString('utf-8')

      // Stripe webhook signature verification
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      )

      this.logger.log(`Webhook verified successfully: ${event.type}`)
      return true
    } catch (error) {
      this.logger.warn(`[StripePaymentProvider] Webhook verification failed: ${error.message}`)
      return false
    }
  }

  /**
   * Parse Stripe webhook payload
   * 
   * Extracts payment result from webhook event
   * Handles:
   * - payment_intent.succeeded
   * - payment_intent.payment_failed
   * - payment_intent.canceled
   */
  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    try {
      const payload = typeof rawPayload === 'string' 
        ? JSON.parse(rawPayload) 
        : JSON.parse(rawPayload.toString('utf-8'))

      const event = payload as Stripe.Event

      // Extract payment intent from event
      let intent: Stripe.PaymentIntent
      
      if (event.type === 'payment_intent.succeeded' ||
          event.type === 'payment_intent.payment_failed' ||
          event.type === 'payment_intent.canceled') {
        intent = event.data.object as Stripe.PaymentIntent
      } else {
        throw new BadRequestException(`Unsupported webhook event: ${event.type}`)
      }

      const orderId = intent.metadata.orderId
      if (!orderId) {
        throw new BadRequestException('Webhook missing orderId in metadata')
      }

      // Extract currency and amount from Stripe
      const amountCents = intent.amount
      const currency = intent.currency.toUpperCase() as any

      return {
        intentId: intent.id,
        orderId,
        status: this.mapStripeStatusToNormalized(intent.status),
        amount: new MoneyValue(amountCents, currency.toUpperCase() as any),
        paidAt: intent.status === 'succeeded' 
          ? new Date()
          : new Date(),
        metadata: {
          stripeIntentId: intent.id,
          stripeStatus: intent.status,
          eventType: event.type,
          eventId: event.id,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to parse webhook: ${error.message}`)
      throw new BadRequestException(`Invalid webhook payload: ${error.message}`)
    }
  }

  /**
   * Refund a Stripe payment
   * 
   * - Partial refunds supported
   * - Full refund if amount omitted
   */
  async refund(paymentId: string, amount?: MoneyValue): Promise<RefundResult> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentId,
      }

      if (amount) {
        refundParams.amount = amount.amountCents
      }

      const refund = await this.stripe.refunds.create(refundParams)

      this.logger.log(`Refund created: ${refund.id} for payment ${paymentId}`)

      return {
        refundId: refund.id,
        orderId: '', // Would need to fetch from payment intent
        originalPaymentId: paymentId,
        amountRefunded: new MoneyValue(
          refund.amount,
          (refund.currency || 'usd').toUpperCase() as any
        ),
        refundedAt: new Date(refund.created * 1000),
        metadata: {
          stripeRefundId: refund.id,
          stripeStatus: refund.status,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to refund payment: ${error.message}`)
      throw new InternalServerErrorException(
        `Refund failed: ${error.message}`
      )
    }
  }

  /**
   * Check payment status with Stripe
   * 
   * Useful for reconciliation or async polling
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentId)
      return this.mapStripeStatusToNormalized(intent.status)
    } catch (error) {
      this.logger.error(`Failed to retrieve payment status: ${error.message}`)
      throw new InternalServerErrorException(
        `Failed to check payment status: ${error.message}`
      )
    }
  }

  /**
   * Map Stripe payment intent status to normalized internal status
   * 
   * Stripe statuses:
   * - requires_payment_method
   * - processing
   * - succeeded
   * - canceled
   * - requires_action (3D Secure)
   * - requires_confirmation
   */
  private mapStripeStatusToNormalized(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending'
      case 'processing':
        return 'processing'
      case 'succeeded':
        return 'paid'
      case 'canceled':
        return 'cancelled'
      default:
        return 'failed'
    }
  }
}
