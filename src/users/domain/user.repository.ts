import { ShippingAddress } from './shipping-address.entity'
import { UserPaymentMethod } from './payment-method.entity'

export interface UserRepository {
  // Shipping Addresses
  createShippingAddress(address: ShippingAddress): Promise<ShippingAddress>
  getShippingAddress(userId: number, addressId: string): Promise<ShippingAddress | null>
  listShippingAddresses(userId: number): Promise<ShippingAddress[]>
  updateShippingAddress(address: ShippingAddress): Promise<ShippingAddress>
  softDeleteShippingAddress(addressId: string): Promise<void>
  getDefaultShippingAddress(userId: number): Promise<ShippingAddress | null>

  // Check if address can be deleted (not in active order)
  isAddressInUse(addressId: string): Promise<boolean>

  // Payment Methods
  createPaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod>
  getPaymentMethod(userId: number, methodId: string): Promise<UserPaymentMethod | null>
  listPaymentMethods(userId: number): Promise<UserPaymentMethod[]>
  updatePaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod>
  softDeletePaymentMethod(methodId: string): Promise<void>
  getDefaultPaymentMethod(userId: number): Promise<UserPaymentMethod | null>
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')
