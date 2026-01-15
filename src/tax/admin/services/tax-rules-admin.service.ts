import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'

export interface CreateTaxRuleDto {
  country: string
  state?: string
  city?: string
  taxRate: number
}

export interface UpdateTaxRuleDto {
  country?: string
  state?: string
  city?: string
  taxRate?: number
}

@Injectable()
export class TaxRulesAdminService {
  private readonly logger = new Logger(TaxRulesAdminService.name)

  constructor(private prisma: PrismaService) {}

  async listTaxRules(
    filters?: { country?: string },
    sort?: { by: string; order: 'asc' | 'desc' },
    pagination?: { limit: number; offset: number }
  ) {
    try {
      const pageNum = pagination?.offset || 0
      const limitNum = pagination?.limit || 20
      const sortBy = sort?.by || 'country'
      const sortOrder = sort?.order || 'asc'

      const [taxRules, total] = await Promise.all([
        this.prisma.taxRule.findMany({
          where: filters?.country ? { country: filters.country } : {},
          orderBy: { [sortBy]: sortOrder },
          take: limitNum,
          skip: pageNum,
        }),
        this.prisma.taxRule.count({
          where: filters?.country ? { country: filters.country } : {},
        }),
      ])

      return {
        data: taxRules,
        meta: {
          page: Math.floor(pageNum / limitNum) + 1,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      }
    } catch (error) {
      this.logger.error(`Failed to list tax rules: ${error.message}`)
      throw new InternalServerErrorException('Failed to list tax rules')
    }
  }

  async createTaxRule(dto: CreateTaxRuleDto) {
    try {
      this.validateTaxRuleData(dto)

      const taxRule = await this.prisma.taxRule.create({
        data: {
          country: dto.country.toUpperCase(),
          state: dto.state || null,
          city: dto.city || null,
          taxRatePercent: dto.taxRate,
          taxRateDecimal: parseFloat((dto.taxRate / 100).toFixed(4)),
          isActive: true,
        },
      })

      this.logger.log(`Tax rule created: ${taxRule.id}`)
      return taxRule
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to create tax rule: ${error.message}`)
      throw new InternalServerErrorException('Failed to create tax rule')
    }
  }

  async updateTaxRule(id: string, dto: UpdateTaxRuleDto) {
    try {
      const existing = await this.prisma.taxRule.findUnique({ where: { id } })
      if (!existing) {
        throw new BadRequestException('Tax rule not found')
      }

      if (dto.taxRate !== undefined) {
        if (dto.taxRate < 0 || dto.taxRate > 100) {
          throw new BadRequestException('Tax rate must be between 0 and 100')
        }
      }

      const updated = await this.prisma.taxRule.update({
        where: { id },
        data: {
          country: dto.country ? dto.country.toUpperCase() : undefined,
          state: dto.state !== undefined ? dto.state : undefined,
          city: dto.city !== undefined ? dto.city : undefined,
          taxRatePercent: dto.taxRate !== undefined ? dto.taxRate : undefined,
          taxRateDecimal: dto.taxRate !== undefined ? parseFloat((dto.taxRate / 100).toFixed(4)) : undefined,
        },
      })

      this.logger.log(`Tax rule updated: ${id}`)
      return updated
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to update tax rule: ${error.message}`)
      throw new InternalServerErrorException('Failed to update tax rule')
    }
  }

  async deleteTaxRule(id: string) {
    try {
      const existing = await this.prisma.taxRule.findUnique({ where: { id } })
      if (!existing) {
        throw new BadRequestException('Tax rule not found')
      }

      await this.prisma.taxRule.delete({ where: { id } })
      this.logger.log(`Tax rule deleted: ${id}`)
      return { success: true }
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to delete tax rule: ${error.message}`)
      throw new InternalServerErrorException('Failed to delete tax rule')
    }
  }

  validateTaxRuleData(data: any) {
    if (!data.country || data.country.trim().length === 0) {
      throw new BadRequestException('Country is required')
    }

    if (data.taxRate < 0 || data.taxRate > 100) {
      throw new BadRequestException('Tax rate must be between 0 and 100')
    }

    return true
  }
}
