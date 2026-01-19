import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ShippingAddress } from '../domain/shipping-address.entity'
import { UserPaymentMethod } from '../domain/payment-method.entity'
import { UserRepository } from '../domain/user.repository'

@Injectable()
export class UserRepositoryPrisma implements UserRepository {
  constructor(private prisma: PrismaService) {}

  // --- SHIPPING ADDRESSES ---

  async createShippingAddress(address: ShippingAddress): Promise<ShippingAddress> {
    const created = await this.prisma.userShippingAddress.create({
      data: {
        id: address.id,
        userId: address.userId,
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
        isActive: address.isActive,
      },
    })

    return new ShippingAddress(created)
  }

  async getShippingAddress(userId: number, addressId: string): Promise<ShippingAddress | null> {
    const address = await this.prisma.userShippingAddress.findFirst({
      where: { id: addressId, userId },
    })
    return address ? new ShippingAddress(address) : null
  }

  async listShippingAddresses(userId: number): Promise<ShippingAddress[]> {
    const addresses = await this.prisma.userShippingAddress.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return addresses.map(a => new ShippingAddress(a))
  }

  async updateShippingAddress(address: ShippingAddress): Promise<ShippingAddress> {
    const updated = await this.prisma.userShippingAddress.update({
      where: { id: address.id },
      data: {
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
        updatedAt: address.updatedAt,
      },
    })
    return new ShippingAddress(updated)
  }

  async softDeleteShippingAddress(addressId: string): Promise<void> {
    await this.prisma.userShippingAddress.update({
      where: { id: addressId },
      data: { isActive: false, deletedAt: new Date() },
    })
  }

  async getDefaultShippingAddress(userId: number): Promise<ShippingAddress | null> {
    const address = await this.prisma.userShippingAddress.findFirst({
      where: { userId, isDefault: true, isActive: true },
    })
    return address ? new ShippingAddress(address) : null
  }

  async isAddressInUse(addressId: string): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: {
        shippingAddress: { id: addressId },
        status: { in: ['PENDING', 'CHECKOUT', 'PAID'] },
      },
    })
    return !!order
  }

  // --- PAYMENT METHODS ---

  async createPaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod> {
    const created = await this.prisma.userPaymentMethod.create({
      data: {
        id: method.id,
        userId: method.userId,
        provider: method.provider,
        providerTokenId: method.providerTokenId,
        type: method.type,
        brand: method.brand,
        last4Digits: method.last4Digits,
        expiryMonth: method.expiryMonth,
        expiryYear: method.expiryYear,
        cardholderName: method.cardholderName,
        billingStreetLine1: (method as any).billingStreetLine1,
        billingStreetLine2: (method as any).billingStreetLine2,
        billingCity: (method as any).billingCity,
        billingStateProvince: (method as any).billingStateProvince,
        billingPostalCode: (method as any).billingPostalCode,
        billingCountry: (method as any).billingCountry,
        label: method.label,
        isDefault: method.isDefault,
        isActive: method.isActive,
      },
    })
    return new UserPaymentMethod(created)
  }

  async getPaymentMethod(userId: number, methodId: string): Promise<UserPaymentMethod | null> {
    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { id: methodId, userId },
    })
    return method ? new UserPaymentMethod(method) : null
  }

  async listPaymentMethods(userId: number): Promise<UserPaymentMethod[]> {
    const methods = await this.prisma.userPaymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return methods.map(m => new UserPaymentMethod(m))
  }

  async softDeletePaymentMethod(methodId: string): Promise<void> {
    await this.prisma.userPaymentMethod.update({
      where: { id: methodId },
      data: { isActive: false, deletedAt: new Date() },
    })
  }

  async getDefaultPaymentMethod(userId: number): Promise<UserPaymentMethod | null> {
    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { userId, isDefault: true, isActive: true },
    })
    return method ? new UserPaymentMethod(method) : null
  }

  async updatePaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod> {
    const updated = await this.prisma.userPaymentMethod.update({
      where: { id: method.id },
      data: {
        label: method.label,
        isDefault: method.isDefault,
        isActive: method.isActive,
        updatedAt: method.updatedAt,
      },
    })
    return new UserPaymentMethod(updated)
  }
}
