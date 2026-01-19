export interface CreateAddressDto {
  label?: string
  fullName: string
  streetLine1: string
  streetLine2?: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  phoneNumber?: string
}

export interface UpdateAddressDto {
  label?: string
  fullName?: string
  streetLine1?: string
  streetLine2?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
  phoneNumber?: string
}

export class ShippingAddress {
  id: string
  userId: number
  label?: string
  fullName: string
  streetLine1: string
  streetLine2?: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  phoneNumber?: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  constructor(data: Partial<ShippingAddress>) {
    Object.assign(this, data)
  }

  static create(dto: CreateAddressDto, userId: number): ShippingAddress {
    if (!dto.fullName?.trim()) {
      throw new Error('fullName is required')
    }
    if (!dto.country) {
      throw new Error('country is required')
    }

    return new ShippingAddress({
      id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      fullName: dto.fullName.trim(),
      label: dto.label?.trim(),
      streetLine1: dto.streetLine1.trim(),
      streetLine2: dto.streetLine2?.trim(),
      city: dto.city.trim(),
      stateProvince: dto.stateProvince.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country.toUpperCase(),
      phoneNumber: dto.phoneNumber?.trim(),
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  update(dto: UpdateAddressDto): void {
    if (dto.fullName !== undefined) this.fullName = dto.fullName
    if (dto.label !== undefined) this.label = dto.label
    if (dto.streetLine1 !== undefined) this.streetLine1 = dto.streetLine1
    if (dto.streetLine2 !== undefined) this.streetLine2 = dto.streetLine2
    if (dto.city !== undefined) this.city = dto.city
    if (dto.stateProvince !== undefined) this.stateProvince = dto.stateProvince
    if (dto.postalCode !== undefined) this.postalCode = dto.postalCode
    if (dto.country !== undefined) this.country = dto.country
    if (dto.phoneNumber !== undefined) this.phoneNumber = dto.phoneNumber
    this.updatedAt = new Date()
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

  isDeleted(): boolean {
    return !this.isActive && this.deletedAt !== undefined
  }
}
