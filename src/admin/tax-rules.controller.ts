import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { PrismaService } from '../prisma/prisma.service'
import { GetRequestInfo, RequestInfo } from '../common/decorators/request-info.decorator'

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

@Controller('api/admin/tax-rules')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TaxRulesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllTaxRules(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    const [taxRules, total] = await Promise.all([
      this.prisma.taxRule.findMany({
        skip,
        take: limitNum,
        orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }],
      }),
      this.prisma.taxRule.count(),
    ])

    return {
      data: taxRules,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTaxRule(
    @Body() dto: CreateTaxRuleDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    if (!dto.country || dto.country.trim().length === 0) {
      throw new Error('Country is required')
    }

    if (dto.taxRate < 0 || dto.taxRate > 100) {
      throw new Error('Tax rate must be between 0 and 100')
    }

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

    return taxRule
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateTaxRule(
    @Param('id') id: string,
    @Body() dto: UpdateTaxRuleDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    const existing = await this.prisma.taxRule.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Tax rule not found')
    }

    if (dto.taxRate !== undefined) {
      if (dto.taxRate < 0 || dto.taxRate > 100) {
        throw new Error('Tax rate must be between 0 and 100')
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

    return updated
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTaxRule(
    @Param('id') id: string,
    @GetRequestInfo() info: RequestInfo,
  ) {
    const existing = await this.prisma.taxRule.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Tax rule not found')
    }

    await this.prisma.taxRule.delete({ where: { id } })
  }
}
