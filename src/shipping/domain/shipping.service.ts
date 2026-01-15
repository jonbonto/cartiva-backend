import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface ShippingAddress {
  country: string
  state?: string
  city?: string
  postalCode?: string
}

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateShipping(
    address: ShippingAddress,
    shippingMethodId: string,
    weightGrams: number = 0,
  ): Promise<number> {
    if (!address.country) {
      throw new BadRequestException('Country is required for shipping calculation')
    }

    const shippingMethod = await this.prisma.shippingMethod.findUnique({
      where: { id: shippingMethodId },
    })

    if (!shippingMethod) {
      throw new BadRequestException('Shipping method not found')
    }

    if (!shippingMethod.isActive || this.isExpired(shippingMethod.expiresAt)) {
      throw new BadRequestException('Shipping method is no longer available')
    }

    if (
      shippingMethod.allowedCountries.length > 0 &&
      !shippingMethod.allowedCountries.includes(address.country)
    ) {
      throw new BadRequestException(`Shipping method ${shippingMethod.name} does not cover ${address.country}`)
    }

    if (
      weightGrams < shippingMethod.minWeightGrams ||
      (shippingMethod.maxWeightGrams && weightGrams > shippingMethod.maxWeightGrams)
    ) {
      throw new BadRequestException(`Weight ${weightGrams}g is outside acceptable range for ${shippingMethod.name}`)
    }

    let shippingCost = shippingMethod.baseCostCents

    if (shippingMethod.perKgCostCents > 0 && weightGrams > 0) {
      const weightKg = weightGrams / 1000
      shippingCost += Math.round(weightKg * shippingMethod.perKgCostCents)
    }

    return shippingCost
  }

  async getAvailableShippingMethods(country: string, weightGrams?: number) {
    const methods = await this.prisma.shippingMethod.findMany({
      where: {
        isActive: true,
        OR: [
          { allowedCountries: { has: country } },
          { allowedCountries: { isEmpty: true } },
        ],
      },
    })

    if (weightGrams !== undefined) {
      return methods.filter((m) => {
        const minOk = weightGrams >= m.minWeightGrams
        const maxOk = !m.maxWeightGrams || weightGrams <= m.maxWeightGrams
        return minOk && maxOk && !this.isExpired(m.expiresAt)
      })
    }

    return methods.filter((m) => !this.isExpired(m.expiresAt))
  }

  async getShippingMethodDetail(shippingMethodId: string, weightGrams: number = 0) {
    const method = await this.prisma.shippingMethod.findUnique({ where: { id: shippingMethodId } })

    if (!method || !method.isActive || this.isExpired(method.expiresAt)) return null

    let estimatedCost = method.baseCostCents
    if (method.perKgCostCents > 0 && weightGrams > 0) {
      const weightKg = weightGrams / 1000
      estimatedCost += Math.round(weightKg * method.perKgCostCents)
    }

    return {
      ...method,
      estimatedCostCents: estimatedCost,
      estimatedDeliveryDays: { min: method.minDeliveryDays, max: method.maxDeliveryDays },
    }
  }

  async createShippingMethod(data: any) {
    return this.prisma.shippingMethod.create({
      data: {
        name: data.name,
        description: data.description,
        baseCostCents: data.baseCostCents,
        perKgCostCents: data.perKgCostCents || 0,
        perKmCostCents: data.perKmCostCents || 0,
        minWeightGrams: data.minWeightGrams || 0,
        maxWeightGrams: data.maxWeightGrams,
        minDeliveryDays: data.minDeliveryDays,
        maxDeliveryDays: data.maxDeliveryDays,
        allowedCountries: data.allowedCountries || [],
        isActive: data.isActive ?? true,
      },
    })
  }

  async updateShippingMethod(id: string, data: any) {
    return this.prisma.shippingMethod.update({ where: { id }, data })
  }

  async getAllShippingMethods() {
    return this.prisma.shippingMethod.findMany({ orderBy: { name: 'asc' } })
  }

  async deleteShippingMethod(id: string) {
    return this.prisma.shippingMethod.delete({ where: { id } })
  }

  private isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return false
    return new Date() > expiresAt
  }
}
