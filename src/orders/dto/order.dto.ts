/**
 * PHASE 6: Order DTOs (updated)
 * Used for API requests/responses
 */

import { Money } from '../../common/types/money'

/**
 * Shipping address for Phase 6
 */
export interface ShippingAddressDto {
  fullName: string
  streetLine1: string
  streetLine2?: string
  city: string
  stateProvince: string
  postalCode: string
  country: string // ISO 3166-1 alpha-2
  phoneNumber?: string
}

/**
 * Create order request DTO (Phase 6 updated)
 * Frontend sends this during checkout
 */
export interface CreateOrderDto {
  cartId: number
  currency: string // 'USD', 'EUR', etc.
  discountCodes?: string[] // Optional: codes to apply
  // Phase 6: Shipping & Tax
  shippingAddress?: ShippingAddressDto // Shipping address
  shippingMethodId?: string // ID of selected shipping method
  estimatedWeight?: number // Weight in grams (optional, for shipping calc)
}

/**
 * Order item DTO for response
 */
export interface OrderItemDto {
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
export interface AppliedDiscountDto {
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
export interface OrderResponseDto {
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
