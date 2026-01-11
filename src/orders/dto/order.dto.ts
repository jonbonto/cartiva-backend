/**
 * PHASE 4: Order DTOs
 * Used for API requests/responses
 */

import { Money } from '../../common/types/money'

/**
 * Create order request DTO
 * Frontend sends this during checkout
 */
export interface CreateOrderDto {
  cartId: number
  currency: string // 'USD', 'EUR', etc.
  discountCodes?: string[] // Optional: codes to apply
}

/**
 * Order item DTO for response
 */
export class OrderItemDto {
  id: string
  productId: number
  productName: string
  pricePerUnitAtPurchase: Money
  quantity: number
  subtotal: Money
}

/**
 * Applied discount DTO
 */
export class AppliedDiscountDto {
  id: string
  code?: string
  type: string // 'percentage' | 'fixed_amount'
  value: number
  appliesTo: string
  amountDeducted: Money
  reason: string
}

/**
 * Order response DTO
 */
export class OrderResponseDto {
  id: string
  userId?: string
  currency: string

  items: OrderItemDto[]
  subtotal: Money
  appliedDiscounts: AppliedDiscountDto[]
  discountTotal: Money
  taxAmount: Money
  shippingCost: Money

  totalBeforePayment: Money
  finalTotal: Money

  createdAt: Date
  paymentStatus?: string // For reference only; actual status in separate Payment entity
}
