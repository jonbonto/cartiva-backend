/**
 * PHASE 4: Extensibility Example — Stripe Payment Provider
 * 
 * This is a REFERENCE IMPLEMENTATION showing how to implement PaymentProvider.
 * NOT production code, but demonstrates the contract clearly.
 * 
 * To use in production:
 * 1. Install stripe SDK: npm install stripe
 * 2. Create StripePaymentProvider class extending this template
 * 3. Register in payment.module.ts
 */

import { PaymentProvider, PaymentIntent, PaymentResult, RefundResult, PaymentStatus } from './payment'
import { Order } from './order'
import { Money } from './money'

/**
 * REFERENCE: How Stripe provider would look
 * (Not full implementation — just the structure)
 */
export class StripePaymentProviderTemplate implements PaymentProvider {
  readonly name = 'stripe'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async createPayment(order: Order, options?: any): Promise<PaymentIntent> {
    // 1. Validate order
    if (!order.items.length) {
      throw new Error('Order must have items')
    }

    // 2. Create Stripe charge
    // Example: const charge = await stripe.charges.create({...})

    // 3. Return normalized PaymentIntent
    return {
      id: 'ch_stripe_xxx', // Stripe's ID
      orderId: order.id,
      status: 'pending' as PaymentStatus,
      amount: order.finalTotal,
      createdAt: new Date(),
      redirectUrl: undefined, // Stripe uses clientSecret for embedded flow
      clientSecret: 'pi_secret_xxx',
      metadata: {
        stripeChargeId: 'ch_stripe_xxx',
        orderItems: order.items.length,
      },
    }
  }

  async verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean> {
    // Use Stripe's utility to verify signature
    // Example: stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret)
    return true // Placeholder
  }

  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    // Parse Stripe webhook (charge.succeeded, charge.failed, etc.)
    // Map Stripe status to normalized status
    return {
      intentId: 'ch_stripe_xxx',
      orderId: 'order_123',
      status: 'paid' as PaymentStatus,
      amount: { amountCents: 1999, currency: 'USD' },
      paidAt: new Date(),
      metadata: { stripeChargeId: 'ch_stripe_xxx' },
    }
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    // Call Stripe refund API
    // Example: await stripe.refunds.create({ charge: paymentId, ...})

    return {
      refundId: 're_stripe_xxx',
      orderId: 'order_123',
      originalPaymentId: paymentId,
      amountRefunded: amount || { amountCents: 1999, currency: 'USD' },
      refundedAt: new Date(),
      metadata: { stripeRefundId: 're_stripe_xxx' },
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    // Check Stripe charge status
    // Example: const charge = await stripe.charges.retrieve(paymentId)
    return 'paid' // Placeholder
  }
}

/**
 * REFERENCE: How Midtrans provider would look
 * (Indonesian payment gateway)
 */
export class MidtransPaymentProviderTemplate implements PaymentProvider {
  readonly name = 'midtrans'
  private serverKey: string

  constructor(serverKey: string) {
    this.serverKey = serverKey
  }

  async createPayment(order: Order, options?: any): Promise<PaymentIntent> {
    // 1. Create Midtrans transaction
    // 2. Midtrans returns transaction_id and redirect_url
    // 3. Return normalized PaymentIntent

    return {
      id: 'midtrans_txn_xxx',
      orderId: order.id,
      status: 'pending' as PaymentStatus,
      amount: order.finalTotal,
      createdAt: new Date(),
      redirectUrl: 'https://app.midtrans.com/payment/xxx', // Midtrans uses redirects
      metadata: { midtransTransactionId: 'midtrans_txn_xxx' },
    }
  }

  async verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean> {
    // Verify Midtrans webhook signature
    return true // Placeholder
  }

  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    // Parse Midtrans notification (payment accepted, pending, denied)
    // Map to normalized status
    return {
      intentId: 'midtrans_txn_xxx',
      orderId: 'order_123',
      status: 'paid' as PaymentStatus,
      amount: { amountCents: 1999, currency: 'IDR' },
      paidAt: new Date(),
      metadata: { midtransTransactionId: 'midtrans_txn_xxx' },
    }
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    // Call Midtrans refund API
    return {
      refundId: 'midtrans_refund_xxx',
      orderId: 'order_123',
      originalPaymentId: paymentId,
      amountRefunded: amount || { amountCents: 100000, currency: 'IDR' },
      refundedAt: new Date(),
      metadata: {},
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    // Check Midtrans status
    return 'paid' // Placeholder
  }
}

/**
 * REFERENCE: How PayPal provider would look
 */
export class PayPalPaymentProviderTemplate implements PaymentProvider {
  readonly name = 'paypal'
  private clientId: string

  constructor(clientId: string) {
    this.clientId = clientId
  }

  async createPayment(order: Order, options?: any): Promise<PaymentIntent> {
    // Create PayPal order
    return {
      id: 'paypal_order_xxx',
      orderId: order.id,
      status: 'pending' as PaymentStatus,
      amount: order.finalTotal,
      createdAt: new Date(),
      redirectUrl: 'https://www.paypal.com/checkoutnow?token=xxx',
      metadata: { paypalOrderId: 'paypal_order_xxx' },
    }
  }

  async verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean> {
    return true // Placeholder
  }

  async parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult> {
    return {
      intentId: 'paypal_order_xxx',
      orderId: 'order_123',
      status: 'paid' as PaymentStatus,
      amount: { amountCents: 1999, currency: 'USD' },
      paidAt: new Date(),
      metadata: { paypalOrderId: 'paypal_order_xxx' },
    }
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    return {
      refundId: 'paypal_refund_xxx',
      orderId: 'order_123',
      originalPaymentId: paymentId,
      amountRefunded: amount || { amountCents: 1999, currency: 'USD' },
      refundedAt: new Date(),
      metadata: {},
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    return 'paid' // Placeholder
  }
}
