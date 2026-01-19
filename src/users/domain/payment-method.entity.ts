export interface AddPaymentMethodDto {
  provider: string
  providerTokenId: string
  type?: string
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  cardholderName?: string
  label?: string
}

export class UserPaymentMethod {
  id: string
  userId: number
  provider: string
  providerTokenId: string // NEVER expose in API
  type: string
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  cardholderName?: string
  label?: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  constructor(data: Partial<UserPaymentMethod>) {
    Object.assign(this, data)
  }

  static create(dto: AddPaymentMethodDto, userId: number): UserPaymentMethod {
    if (!dto.provider) {
      throw new Error('provider is required')
    }
    if (!dto.providerTokenId) {
      throw new Error('providerTokenId is required')
    }

    return new UserPaymentMethod({
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      provider: dto.provider.toLowerCase(),
      providerTokenId: dto.providerTokenId,
      type: dto.type || 'card',
      brand: dto.brand,
      last4Digits: dto.last4Digits,
      expiryMonth: dto.expiryMonth,
      expiryYear: dto.expiryYear,
      cardholderName: dto.cardholderName,
      label: dto.label,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  setAsDefault(): void {
    this.isDefault = true
  }

  unsetAsDefault(): void {
    this.isDefault = false
  }

  softDelete(): void {
    this.isActive = false
    this.deletedAt = new Date()
  }

  canBeUsed(): boolean {
    if (!this.isActive) return false
    if (this.deletedAt) return false

    if (this.expiryMonth && this.expiryYear) {
      const expiry = new Date(this.expiryYear, (this.expiryMonth || 1) - 1)
      if (new Date() > expiry) return false
    }

    return true
  }
}
