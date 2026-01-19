export interface PaymentTokenValidator {
  // Validate the provider token. Returns an object with `valid` boolean
  // and optional `metadata` with provider-supplied payment method details
  validate(provider: string, tokenId: string): Promise<{ valid: boolean; metadata?: any }>
}

export const PAYMENT_TOKEN_VALIDATOR = Symbol('PAYMENT_TOKEN_VALIDATOR')
