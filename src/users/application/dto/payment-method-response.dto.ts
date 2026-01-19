import { UserPaymentMethod } from '../../domain/payment-method.entity'

export class PaymentMethodResponseDto {
  id: string
  provider: string
  type: string
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  label?: string
  isDefault: boolean
  createdAt: Date

  static from(method: UserPaymentMethod): PaymentMethodResponseDto {
    return {
      id: method.id,
      provider: method.provider,
      type: method.type,
      brand: method.brand,
      last4Digits: method.last4Digits,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      label: method.label,
      isDefault: method.isDefault,
      createdAt: method.createdAt,
    }
  }
}
