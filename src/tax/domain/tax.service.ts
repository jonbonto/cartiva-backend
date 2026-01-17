import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface TaxAddress {
  country?: string
  state?: string
  city?: string
}

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateTax(address: TaxAddress, subtotalCents: number): Promise<number> {
    const taxRule = await this.findApplicableTaxRule(address)

    if (!taxRule) return 0

    const taxRateDecimal = parseFloat(taxRule.taxRateDecimal.toString())
    // `taxRateDecimal` is stored as a decimal (e.g., 0.0850 for 8.5%), so multiply directly
    const taxCents = Math.round(subtotalCents * taxRateDecimal)
    return taxCents
  }

  private async findApplicableTaxRule(address: TaxAddress) {
    if (address.city && address.state && address.country) {
      const cityRule = await this.prisma.taxRule.findFirst({
        where: {
          country: address.country,
          state: address.state,
          city: address.city,
        },
      })

      if (cityRule && cityRule.isActive && !this.isExpired(cityRule.expiresAt)) {
        return cityRule
      }
    }

    if (address.state && address.country) {
      const stateRule = await this.prisma.taxRule.findFirst({
        where: {
          country: address.country,
          state: address.state,
          city: null,
        },
      })

      if (stateRule && stateRule.isActive && !this.isExpired(stateRule.expiresAt)) {
        return stateRule
      }
    }

    if (address.country) {
      const countryRule = await this.prisma.taxRule.findFirst({
        where: {
          country: address.country,
          state: null,
          city: null,
        },
      })

      if (countryRule && countryRule.isActive && !this.isExpired(countryRule.expiresAt)) {
        return countryRule
      }
    }

    return null
  }

  private isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return false
    return new Date() > expiresAt
  }

  async createOrUpdateTaxRule(data: any) {
    const taxRateDecimal = (data.taxRatePercent / 100).toFixed(4)

    return this.prisma.taxRule.upsert({
      where: {
        country_state_city: {
          country: data.country || null,
          state: data.state || null,
          city: data.city || null,
        },
      },
      update: {
        taxRatePercent: data.taxRatePercent,
        taxRateDecimal: parseFloat(taxRateDecimal),
        isActive: data.isActive ?? true,
        expiresAt: data.expiresAt || null,
      },
      create: {
        country: data.country || null,
        state: data.state || null,
        city: data.city || null,
        taxRatePercent: data.taxRatePercent,
        taxRateDecimal: parseFloat(taxRateDecimal),
        isActive: data.isActive ?? true,
        expiresAt: data.expiresAt || null,
      },
    })
  }

  async getAllTaxRules() {
    return this.prisma.taxRule.findMany({
      where: { isActive: true },
      orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }],
    })
  }

  async deleteTaxRule(id: string) {
    return this.prisma.taxRule.delete({ where: { id } })
  }
}
