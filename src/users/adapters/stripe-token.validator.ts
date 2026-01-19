import { Injectable, Logger } from '@nestjs/common'
import { PaymentTokenValidator } from '../domain/payment-token.validator'
import Stripe from 'stripe'

@Injectable()
export class StripeTokenValidator implements PaymentTokenValidator {
  private readonly logger = new Logger(StripeTokenValidator.name)
  private stripe?: Stripe

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY
    if (key) {
      try {
        this.stripe = new Stripe(key)
        this.logger.log('StripeTokenValidator initialized with configured STRIPE_SECRET_KEY')
      } catch (err) {
        this.logger.warn('Failed to initialize Stripe SDK: ' + (err as Error).message)
      }
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set; Stripe token validation will fallback to permissive mode')
    }
  }

  async validate(provider: string, tokenId: string): Promise<{ valid: boolean; metadata?: any }> {
    if (!provider || !tokenId) return { valid: false }
    if (provider !== 'stripe') return { valid: false }

    // If stripe client is not configured, fallback to permissive response to avoid blocking local/dev flows.
    if (!this.stripe) {
      this.logger.warn('Stripe client not configured; accepting token without remote verification')
      return { valid: true }
    }

    try {
      // Attempt to retrieve the PaymentMethod by id. If it exists, token is valid.
      const pm = await this.stripe.paymentMethods.retrieve(tokenId)
      if (!pm || pm.id !== tokenId) {
        this.logger.warn(`Stripe token validation: payment method not found for id=${tokenId}`)
        return { valid: false }
      }

      // Extract useful metadata from Stripe PaymentMethod
      const card: any = (pm as any).card || (pm as any).card || undefined
      const metadata: any = {}
      if (card) {
        metadata.brand = card.brand
        metadata.last4Digits = card.last4
        metadata.expiryMonth = card.exp_month
        metadata.expiryYear = card.exp_year
      }
      if ((pm as any).billing_details && (pm as any).billing_details.name) {
        metadata.cardholderName = (pm as any).billing_details.name
      }

      return { valid: true, metadata }
    } catch (err) {
      this.logger.warn(`Stripe token validation failed for id=${tokenId}: ${(err as Error).message}`)
      return { valid: false }
    }
  }
}
