import { Injectable, Logger } from '@nestjs/common'
import { PaymentTokenValidator } from '../domain/payment-token.validator'

@Injectable()
export class StripeTokenValidator implements PaymentTokenValidator {
  private readonly logger = new Logger(StripeTokenValidator.name)

  async validate(provider: string, tokenId: string): Promise<boolean> {
    // Minimal scaffolding: accept tokens for Stripe when API key is present.
    // Replace with real Stripe verification (e.g., retrieve token/payment method)
    if (!provider || !tokenId) return false
    if (provider !== 'stripe') return false
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      this.logger.warn('Stripe secret key not configured; token validation disabled')
      // For scaffolding we accept token if key missing to avoid blocking local dev flows
      return true
    }

    // In a real implementation we'd call Stripe SDK to verify the token/payment method.
    return true
  }
}
