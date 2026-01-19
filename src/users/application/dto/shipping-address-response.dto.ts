import { ShippingAddress } from '../../domain/shipping-address.entity'

export class ShippingAddressResponseDto {
  id: string
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
  createdAt: Date
  updatedAt: Date

  static from(address: ShippingAddress): ShippingAddressResponseDto {
    return {
      id: address.id,
      label: address.label,
      fullName: address.fullName,
      streetLine1: address.streetLine1,
      streetLine2: address.streetLine2,
      city: address.city,
      stateProvince: address.stateProvince,
      postalCode: address.postalCode,
      country: address.country,
      phoneNumber: address.phoneNumber,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    }
  }
}
