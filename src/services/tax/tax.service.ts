import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TaxAddress {
  country?: string; // ISO 3166-1 alpha-2 (e.g., US, CA, AU)
  state?: string;   // State/province code (e.g., CA, NY)
  city?: string;    // City name
}

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate tax for a given shipping address and subtotal.
   * Uses region-based tax rules (most specific match wins).
   * 
   * @param address Shipping address (country, state, city)
   * @param subtotalCents Subtotal in cents (before tax and shipping)
   * @returns Tax amount in cents
   */
  async calculateTax(
    address: TaxAddress,
    subtotalCents: number,
  ): Promise<number> {
    // Find applicable tax rule (most specific match wins)
    const taxRule = await this.findApplicableTaxRule(address);

    if (!taxRule) {
      // No tax rule found, default to no tax
      return 0;
    }

    // Calculate tax: subtotal * tax_rate
    const taxRateDecimal = parseFloat(taxRule.taxRateDecimal.toString());
    const taxCents = Math.round(subtotalCents * (taxRateDecimal / 100));

    return taxCents;
  }

  /**
   * Find the most specific applicable tax rule for an address.
   * Priority: city > state > country > default (no rule)
   */
  private async findApplicableTaxRule(address: TaxAddress) {
    // Try city-specific rule first (most specific)
    if (address.city && address.state && address.country) {
      const cityRule = await this.prisma.taxRule.findUnique({
        where: {
          country_state_city: {
            country: address.country,
            state: address.state,
            city: address.city,
          },
        },
      });

      if (cityRule && cityRule.isActive && !this.isExpired(cityRule.expiresAt)) {
        return cityRule;
      }
    }

    // Try state-level rule (less specific)
    if (address.state && address.country) {
      const stateRule = await this.prisma.taxRule.findUnique({
        where: {
          country_state_city: {
            country: address.country,
            state: address.state,
            city: null,
          },
        },
      });

      if (stateRule && stateRule.isActive && !this.isExpired(stateRule.expiresAt)) {
        return stateRule;
      }
    }

    // Try country-level rule
    if (address.country) {
      const countryRule = await this.prisma.taxRule.findUnique({
        where: {
          country_state_city: {
            country: address.country,
            state: null,
            city: null,
          },
        },
      });

      if (countryRule && countryRule.isActive && !this.isExpired(countryRule.expiresAt)) {
        return countryRule;
      }
    }

    // No applicable rule found
    return null;
  }

  /**
   * Check if a date has expired
   */
  private isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    return new Date() > expiresAt;
  }

  /**
   * Admin: Create or update a tax rule
   */
  async createOrUpdateTaxRule(data: {
    country?: string;
    state?: string;
    city?: string;
    taxRatePercent: number;
    isActive?: boolean;
    expiresAt?: Date;
  }) {
    const taxRateDecimal = (data.taxRatePercent / 100).toFixed(4);

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
    });
  }

  /**
   * Get all tax rules (for admin)
   */
  async getAllTaxRules() {
    return this.prisma.taxRule.findMany({
      where: { isActive: true },
      orderBy: [
        { country: 'asc' },
        { state: 'asc' },
        { city: 'asc' },
      ],
    });
  }

  /**
   * Delete a tax rule
   */
  async deleteTaxRule(id: string) {
    return this.prisma.taxRule.delete({
      where: { id },
    });
  }
}
