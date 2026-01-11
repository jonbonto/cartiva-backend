/**
 * PHASE 4: Order Domain Model
 * 
 * Immutable order snapshot taken at checkout time.
 * Order NEVER references cart.
 * Order is provider-agnostic.
 * 
 * Design principles:
 * - Represents point-in-time state
 * - Contains ALL data needed for payment/fulfillment
 * - Never recalculated after creation
 * - Currency locked at creation
 */

import { Money } from './money'

/**
 * Represents a single item in an order
 * Immutable snapshot of product state at purchase time
 */
export interface OrderItem {
  id: string
  productId: number
  productName: string
  pricePerUnitAtPurchase: Money // Price locked in time
  quantity: number
  subtotal: Money // pricePerUnit * quantity
}

/**
 * Applied discount — immutable record
 * Stored for audit/calculation verification
 */
export interface AppliedDiscount {
  id: string
  code?: string
  type: 'percentage' | 'fixed_amount'
  value: number // e.g., 10 for 10% or 500 for $5
  appliesTo: 'cart_wide' | 'specific_product' | 'category'
  amountDeducted: Money // Actual amount removed from total
  isStackable: boolean
  priority: number
}

/**
 * Complete order entity
 * Immutable after payment initiation
 */
export interface Order {
  id: string
  userId?: string // Optional for guest checkouts (Phase 5)
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'IDR'

  // Items snapshot
  items: OrderItem[]

  // Pricing breakdown (all immutable at creation)
  subtotal: Money // Sum of all item subtotals
  appliedDiscounts: AppliedDiscount[] // In priority order
  discountTotal: Money // Sum of all discounts
  taxAmount: Money // Not yet implemented; placeholder for Phase 5
  shippingCost: Money // Not yet implemented; placeholder for Phase 5

  // Final totals (authoritative)
  totalBeforePayment: Money // subtotal - discounts + tax + shipping
  finalTotal: Money // After any additional processing

  // Metadata
  createdAt: Date
  expiresAt?: Date // For abandoned order cleanup

  // Payment state (not part of Order entity — handled by OrderPayment)
  // Separation of concerns: Order is about the sale, Payment is about the provider interaction
}

/**
 * Order validation rules (business rules layer)
 */
export class OrderValidator {
  /**
   * Validate order meets all business requirements
   */
  static validate(order: Order): void {
    if (!order.items || order.items.length === 0) {
      throw new Error('Order must contain at least one item')
    }

    // Verify totals add up
    const calculatedSubtotal = order.items.reduce((sum, item) => {
      return sum + item.subtotal.amountCents
    }, 0)

    if (order.subtotal.amountCents !== calculatedSubtotal) {
      throw new Error(
        `Subtotal mismatch. Expected: ${calculatedSubtotal}, Got: ${order.subtotal.amountCents}`
      )
    }

    // Verify discount logic
    const calculatedDiscountTotal = order.appliedDiscounts.reduce((sum, d) => {
      return sum + d.amountDeducted.amountCents
    }, 0)

    if (order.discountTotal.amountCents !== calculatedDiscountTotal) {
      throw new Error(
        `Discount total mismatch. Expected: ${calculatedDiscountTotal}, Got: ${order.discountTotal.amountCents}`
      )
    }

    // Verify final total
    const calculatedTotal =
      order.subtotal.amountCents -
      order.discountTotal.amountCents +
      (order.taxAmount?.amountCents || 0) +
      (order.shippingCost?.amountCents || 0)

    if (order.finalTotal.amountCents !== calculatedTotal) {
      throw new Error(
        `Final total mismatch. Expected: ${calculatedTotal}, Got: ${order.finalTotal.amountCents}`
      )
    }

    // All amounts must be same currency
    const baseCurrency = order.subtotal.currency
    const allSameCurrency =
      order.appliedDiscounts.every((d) => d.amountDeducted.currency === baseCurrency) &&
      (!order.taxAmount || order.taxAmount.currency === baseCurrency) &&
      (!order.shippingCost || order.shippingCost.currency === baseCurrency) &&
      order.finalTotal.currency === baseCurrency

    if (!allSameCurrency) {
      throw new Error('All order amounts must be in same currency')
    }
  }
}
