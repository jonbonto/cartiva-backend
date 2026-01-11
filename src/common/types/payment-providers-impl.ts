/**
 * PHASE 5: Example Payment Provider Implementation
 * 
 * This is a reference implementation.
 * Each real provider (Stripe, Midtrans, PayPal) should follow this pattern.
 * 
 * This file can be extended or copied to implement specific providers.
 */

import {
  PaymentProvider,
  PaymentIntent,
  PaymentResult,
  RefundResult,
} from './payment'
import { Order } from './order'
import { Money } from './money'

/**
 * MockPaymentProvider for testing
 * Always succeeds, useful for E2E testing without real provider
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock'

  async createPayment(order: Order): Promise<PaymentIntent> {
    return {
      id: `mock_payment_${Date.now()}`,
      orderId: order.id,
      status: 'pending',
      amount: order.finalTotal,
      createdAt: new Date(),
      metadata: { mockProvider: true },
    }
  }

  async verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean> {
    // Mock always returns true
    return true
  }

  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload

    return {
      intentId: payload.id,
      orderId: payload.orderId,
      status: payload.status,
      amount: {
        amountCents: payload.amountCents,
        currency: payload.currency,
      },
      paidAt: new Date(),
      metadata: payload,
    }
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    return {
      refundId: `mock_refund_${Date.now()}`,
      orderId: '', // Would be populated in real implementation
      originalPaymentId: paymentId,
      amountRefunded: amount || { amountCents: 0, currency: 'USD' },
      refundedAt: new Date(),
      metadata: { mockRefund: true },
    }
  }

  async getPaymentStatus(paymentId: string): Promise<'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled'> {
    return 'paid'
  }
}

/**
 * StripePaymentProvider template
 * 
 * To implement:
 * 1. Install: npm install stripe
 * 2. Set STRIPE_SECRET_KEY in .env
 * 3. Implement signature verification using stripe.webhooks.constructEvent()
 * 4. Implement createPayment() to call stripe.paymentIntents.create()
 * 5. Handle webhook events: payment_intent.succeeded, payment_intent.payment_failed
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPayment(order: Order): Promise<PaymentIntent> {
    // TODO: Implement using stripe library
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // const intent = await stripe.paymentIntents.create({...})
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean> {
    // TODO: Implement using stripe.webhooks.constructEvent()
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    // TODO: Implement parsing webhook event
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    // TODO: Implement using stripe.refunds.create()
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPaymentStatus(paymentId: string): Promise<'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled'> {
    // TODO: Implement using stripe.paymentIntents.retrieve()
    throw new Error('Not implemented')
  }
}

/**
 * MidtransPaymentProvider template
 * 
 * To implement:
 * 1. Install Midtrans Node client
 * 2. Set MIDTRANS_SERVER_KEY in .env
 * 3. Implement createPayment() for redirect-based checkout
 * 4. Implement webhook handling for payment notifications
 */
export class MidtransPaymentProvider implements PaymentProvider {
  readonly name = 'midtrans'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPayment(order: Order): Promise<PaymentIntent> {
    // TODO: Implement using midtrans-client
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean> {
    // TODO: Implement Midtrans signature verification
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    // TODO: Implement parsing Midtrans notification
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    // TODO: Implement using Midtrans refund API
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPaymentStatus(paymentId: string): Promise<'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled'> {
    // TODO: Implement using Midtrans transaction status API
    throw new Error('Not implemented')
  }
}
