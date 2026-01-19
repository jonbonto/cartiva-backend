export interface PaymentTokenValidator {
  validate(provider: string, tokenId: string): Promise<boolean>
}

export const PAYMENT_TOKEN_VALIDATOR = Symbol('PAYMENT_TOKEN_VALIDATOR')
