import { Injectable } from '@nestjs/common'
import { DiscountRuleRepository } from '../domain/discount-rule.repository'

export type ValidateDiscountInput = {
  code: string
  cartSubtotalCents: number
  productIds?: number[]
}

export type ValidateDiscountResult = {
  valid: boolean
  ruleId?: string
  amountDeductedCents?: number
  reason?: string
  message?: string
}

@Injectable()
export class ValidateDiscountUseCase {
  constructor(private readonly repo: DiscountRuleRepository) {}

  async execute(input: ValidateDiscountInput): Promise<ValidateDiscountResult> {
    const { code, cartSubtotalCents, productIds } = input
    if (!code) return { valid: false, message: 'empty code' }

    const rule = await this.repo.findByCode(code)
    if (!rule) return { valid: false, message: 'code not found' }

    // Basic checks: active, expiry, usage limits, min cart value, product scope
    if (!rule.isActive) return { valid: false, ruleId: rule.id, message: 'rule inactive' }
    if (rule.expiresAt && new Date() > new Date(rule.expiresAt)) {
      return { valid: false, ruleId: rule.id, message: 'rule expired' }
    }
    if (rule.maxUsageCount !== null && rule.usageCount >= (rule.maxUsageCount ?? 0)) {
      return { valid: false, ruleId: rule.id, message: 'usage limit reached' }
    }
    if (rule.minCartValueCents !== null && cartSubtotalCents < (rule.minCartValueCents ?? 0)) {
      return { valid: false, ruleId: rule.id, message: 'cart value too low' }
    }
    if (rule.appliesTo === 'specific_product') {
      const targets = new Set(rule.targetProductIds || [])
      const has = (productIds || []).some((p) => targets.has(p))
      if (!has) return { valid: false, ruleId: rule.id, message: 'no matching product in cart' }
    }

    // Compute discount amount
    let amount = 0
    if (rule.type === 'percentage') {
      amount = Math.floor((cartSubtotalCents * rule.value) / 100)
    } else {
      // fixed_amount stored in cents
      amount = Math.min(rule.value, cartSubtotalCents)
    }

    return {
      valid: true,
      ruleId: rule.id,
      amountDeductedCents: amount,
      reason: rule.code ? `${rule.code}: ${rule.type === 'percentage' ? `${rule.value}% off` : `$${(rule.value / 100).toFixed(2)} off`}` : undefined,
    }
  }
}
