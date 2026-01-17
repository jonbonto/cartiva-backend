export interface ValidateDiscountDto {
  code: string
  cartSubtotalCents: number
  productIds?: number[]
}

export interface ValidateDiscountResponseDto {
  valid: boolean
  ruleId?: string
  amountDeductedCents?: number
  reason?: string
  message?: string
}
