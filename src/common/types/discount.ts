/**
 * PHASE 4: Discount & Promotion Engine
 * 
 * Composable discount system that supports:
 * - Percentage discounts
 * - Fixed amount discounts
 * - Stackable and non-stackable rules
 * - Scope: cart-wide, product-specific, category-based
 * 
 * Design principles:
 * - Discounts are applied BEFORE payment
 * - Results are stored, never recalculated
 * - Engine is deterministic (same inputs = same output)
 * - Discounts cannot modify prices after application
 */

import { Money, CurrencyCode } from './money'

export interface CartItem {
  id: number
  productId: number
  quantity: number
  product: {
    id: number
    name: string
    priceInCents: number
    imageUrl?: string
  }
}

/**
 * Discount definition
 */
export interface DiscountRule {
  id: string
  code?: string // e.g., "SAVE10" for user-facing codes
  type: 'percentage' | 'fixed_amount'
  // For `percentage` type: value is percent (e.g. 10 means 10%).
  // For `fixed_amount` type: value is stored in cents (e.g. 500 means $5.00).
  value: number
  appliesTo: 'cart_wide' | 'specific_product' | 'category'
  targetProductIds?: number[] // If appliesTo: specific_product
  targetCategories?: string[] // If appliesTo: category (future)
  minCartValue?: Money // Only apply if cart >= this value
  maxUsageCount?: number // e.g., 100 uses per code
  usageCount?: number // Current usage
  isStackable: boolean // Can combine with other discounts?
  priority: number // Higher priority applied first
  isActive: boolean
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Result of discount application
 */
export interface DiscountApplication {
  ruleId: string
  code?: string
  amountDeducted: Money // Actual amount removed
  reason: string // For logging: "10% off" or "$5 off"
}

/**
 * Discount engine — core business logic
 */
export class DiscountEngine {
  /**
   * Apply discounts to cart
   * Returns array of applied discounts (in priority order)
   * Throws if rules are invalid
   *
   * @param cartItems Items in cart
   * @param rules Discount rules to consider
   * @param cartCurrency Currency for all calculations
   * @returns Array of applied discounts (lowest priority first)
   */
  static applyDiscounts(
    cartItems: CartItem[],
    rules: DiscountRule[],
    cartCurrency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'IDR'
  ): DiscountApplication[] {
    // Validate all rules
    rules.forEach((rule) => this.validateRule(rule))

    // Filter applicable rules
    const applicableRules = this.filterApplicableRules(cartItems, rules, cartCurrency)

    // Sort by priority (higher first)
    const sortedRules = applicableRules.sort((a, b) => b.priority - a.priority)

    // Apply discounts
    let cartSubtotal = this.calculateCartSubtotal(cartItems)
    const applied: DiscountApplication[] = []
    const usedNonStackable: Set<string> = new Set()

    for (const rule of sortedRules) {
      // Check if any non-stackable rule already applied
      if (!rule.isStackable && usedNonStackable.size > 0) {
        continue // Skip non-stackable if another non-stackable already used
      }

      // Check if this rule is non-stackable and others exist
      if (!rule.isStackable) {
        usedNonStackable.add(rule.id)
      }

      const amountDeducted = this.calculateDiscount(cartSubtotal, rule, cartCurrency)

      applied.push({
        ruleId: rule.id,
        code: rule.code,
        amountDeducted,
        reason: this.formatReason(rule),
      })

      // Update cartSubtotal for next rule (if stackable)
      if (rule.isStackable) {
        cartSubtotal = cartSubtotal - amountDeducted.amountCents
      }
    }

    return applied
  }

  /**
   * Validate discount rule consistency
   */
  private static validateRule(rule: DiscountRule): void {
    if (rule.type === 'percentage') {
      if (rule.value < 0 || rule.value > 100) {
        throw new Error(`Percentage discount must be 0-100, got ${rule.value}`)
      }
    } else if (rule.type === 'fixed_amount') {
      if (rule.value < 0) {
        throw new Error(`Fixed amount discount must be non-negative, got ${rule.value}`)
      }
    }

    if (rule.appliesTo === 'specific_product' && !rule.targetProductIds) {
      throw new Error('Discount with appliesTo: specific_product must have targetProductIds')
    }

    if (rule.priority < 0) {
      throw new Error(`Priority must be non-negative, got ${rule.priority}`)
    }

    if (rule.expiresAt && new Date() > rule.expiresAt) {
      throw new Error(`Discount rule expired at ${rule.expiresAt}`)
    }

    if (rule.usageCount !== undefined && rule.maxUsageCount !== undefined) {
      if (rule.usageCount >= rule.maxUsageCount) {
        throw new Error(`Discount rule usage limit reached (${rule.usageCount}/${rule.maxUsageCount})`)
      }
    }
  }

  /**
   * Filter rules applicable to this cart
   */
  private static filterApplicableRules(
    cartItems: CartItem[],
    rules: DiscountRule[],
    currency: string
  ): DiscountRule[] {
    const cartSubtotal = this.calculateCartSubtotal(cartItems)
    const applicableProductIds = new Set(cartItems.map((item) => item.productId))

    return rules.filter((rule) => {
      if (!rule.isActive) return false
      if (rule.expiresAt && new Date() > rule.expiresAt) return false

      // Check minimum cart value
      if (rule.minCartValue && cartSubtotal < rule.minCartValue.amountCents) {
        return false
      }

      // Check scope applicability
      if (rule.appliesTo === 'specific_product') {
        const hasApplicableProduct = rule.targetProductIds?.some((id) =>
          applicableProductIds.has(id)
        )
        if (!hasApplicableProduct) return false
      }

      // Future: category checks
      if (rule.appliesTo === 'category') {
        return false // Not yet implemented
      }

      return true
    })
  }

  /**
   * Calculate how much discount a rule provides
   */
  private static calculateDiscount(
    amountCents: number,
    rule: DiscountRule,
    currency: CurrencyCode
  ): Money {
    if (rule.type === 'percentage') {
      const discountCents = Math.floor((amountCents * rule.value) / 100)
      return { amountCents: discountCents, currency }
    } else {
      // fixed_amount: `rule.value` is already in cents
      const discountCents = Math.min(rule.value, amountCents) // Don't discount more than total
      return { amountCents: discountCents, currency }
    }
  }

  /**
   * Calculate cart subtotal in cents
   */
  private static calculateCartSubtotal(cartItems: CartItem[]): number {
    return cartItems.reduce((sum, item) => sum + item.product.priceInCents * item.quantity, 0)
  }

  /**
   * Format discount reason for display
   */
  private static formatReason(rule: DiscountRule): string {
    const prefix = rule.code ? `${rule.code}: ` : ''

    if (rule.type === 'percentage') {
      return `${prefix}${rule.value}% off`
    } else {
      // value is cents; format dollars
      const dollars = (rule.value / 100).toFixed(2)
      return `${prefix}$${dollars} off`
    }
  }
}

/**
 * Discount validation — business rules
 */
export class DiscountValidator {
  /**
   * Validate discount rule for creation/update
   */
  static validateForSave(rule: Partial<DiscountRule>): void {
    if (rule.type === 'percentage' && (rule.value < 0 || rule.value > 100)) {
      throw new Error(`Percentage must be 0-100, got ${rule.value}`)
    }

    if (rule.type === 'fixed_amount' && rule.value < 0) {
      throw new Error(`Fixed amount must be non-negative`)
    }

    if (rule.appliesTo === 'specific_product' && (!rule.targetProductIds || rule.targetProductIds.length === 0)) {
      throw new Error('Product-specific discount requires at least one target product')
    }

    if (rule.priority !== undefined && rule.priority < 0) {
      throw new Error('Priority must be non-negative')
    }
  }

  /**
   * Validate discount code format
   */
  static validateCode(code: string): void {
    if (code.length < 3 || code.length > 20) {
      throw new Error('Code must be 3-20 characters')
    }

    if (!/^[A-Z0-9]+$/.test(code)) {
      throw new Error('Code must contain only uppercase letters and numbers')
    }
  }
}
