/**
 * PHASE 4: Payment Provider Abstraction
 * 
 * Every payment provider must implement this interface.
 * This ensures provider-agnostic order handling.
 * 
 * Principles:
 * - Order creation is decoupled from payment initiation
 * - Provider returns normalized status (not provider-specific enums)
 * - Provider CANNOT modify order
 * - Provider CANNOT calculate totals
 * - Webhook verification is provider's responsibility
 */

import { Order } from './order'
import { Money } from './money'

/**
 * Normalized payment status across all providers
 */
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled'

/**
 * Payment intent returned by provider
 * Normalized format for all providers
 */
export interface PaymentIntent {
  id: string // Provider's payment ID (e.g., Stripe charge_xxx, Midtrans transaction_id)
  orderId: string
  status: PaymentStatus
  amount: Money
  createdAt: Date
  expiresAt?: Date
  redirectUrl?: string // For redirect-based providers (Midtrans, PayPal)
  clientSecret?: string // For embedded providers (Stripe)
  metadata: Record<string, unknown> // For provider-specific data
}

/**
 * Result of payment completion
 */
export interface PaymentResult {
  intentId: string
  orderId: string
  status: PaymentStatus
  amount: Money
  paidAt: Date
  metadata: Record<string, unknown>
}

/**
 * Result of payment refund
 */
export interface RefundResult {
  refundId: string
  orderId: string
  originalPaymentId: string
  amountRefunded: Money
  refundedAt: Date
  reason?: string
  metadata: Record<string, unknown>
}

/**
 * Payment provider interface
 * All providers must implement these methods
 */
export interface PaymentProvider {
  /**
   * Provider name (for logging, selection)
   */
  readonly name: string

  /**
   * Create payment intent from order
   * Order must be valid and immutable by this point
   *
   * @param order Immutable order object
   * @returns PaymentIntent with provider's normalized data
   * @throws Error if order is invalid or provider fails
   */
  createPayment(order: Order): Promise<PaymentIntent>

  /**
   * Verify webhook authenticity
   * Called when provider sends callback
   *
   * @param rawPayload Raw webhook body (as string or buffer)
   * @param signature Provider's signature header
   * @returns true if signature is valid
   */
  verifyWebhookSignature(rawPayload: string | Buffer, signature: string): Promise<boolean>

  /**
   * Parse webhook payload
   * Returns normalized payment result
   *
   * @param rawPayload Webhook body
   * @returns PaymentResult with normalized data
   * @throws Error if payload is invalid
   */
  parseWebhookPayload(rawPayload: string | Buffer): Promise<PaymentResult>

  /**
   * Refund a payment
   * Partial refunds supported (omit amount for full refund)
   *
   * @param paymentId Provider's payment ID
   * @param amount Optional: amount to refund. If omitted, refund full amount
   * @returns RefundResult with provider's refund data
   * @throws Error if refund fails
   */
  refund(paymentId: string, amount?: Money): Promise<RefundResult>

  /**
   * Check payment status with provider
   * Useful for async resolution
   *
   * @param paymentId Provider's payment ID
   * @returns Current payment status
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>
}

/**
 * Payment provider registry
 * Allows runtime provider selection
 */
export class PaymentProviderRegistry {
  private providers: Map<string, PaymentProvider> = new Map()

  /**
   * Register a payment provider
   */
  register(provider: PaymentProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Payment provider '${provider.name}' already registered`)
    }
    this.providers.set(provider.name, provider)
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new Error(`Payment provider '${name}' not found. Registered: ${Array.from(this.providers.keys()).join(', ')}`)
    }
    return provider
  }

  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Check if provider exists
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name)
  }
}
