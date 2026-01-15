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
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'
import { AdminGuard } from '../../auth/guards/admin.guard'
import { PrismaService } from '../../prisma/prisma.service'
import { FeatureFlagsService, FeatureFlag } from '../../feature-flags/feature-flags.service'
import { ShippingMethodsAdminService } from './services/shipping-methods-admin.service'
import { GetRequestInfo, RequestInfo } from '../../common/decorators/request-info.decorator'

export interface CreateShippingMethodDto {
  name: string
  description?: string
  baseCostCents: number
  perKgCostCents?: number
  minWeightGrams?: number
  maxWeightGrams?: number
  minDeliveryDays: number
  maxDeliveryDays: number
  supportedCountries: string[]
  active?: boolean
}

export interface UpdateShippingMethodDto {
  name?: string
  description?: string
  baseCostCents?: number
  perKgCostCents?: number
  minWeightGrams?: number
  maxWeightGrams?: number
  minDeliveryDays?: number
  maxDeliveryDays?: number
  supportedCountries?: string[]
  active?: boolean
}

@Controller('api/admin/shipping-methods')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ShippingMethodsController {
  constructor(
    private shippingMethodsAdminService: ShippingMethodsAdminService,
    private featureFlags: FeatureFlagsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllShippingMethods(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    if (this.featureFlags.isEnabled(FeatureFlag.SHIPPING_SERVICE_LAYER)) {
      return this.shippingMethodsAdminService.listShippingMethods(undefined, { by: 'name', order: 'asc' }, { limit: limitNum, offset: skip })
    }

    const [methods, total] = await Promise.all([
      this.prisma.shippingMethod.findMany({
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.shippingMethod.count(),
    ])

    return {
      data: methods,
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
  async createShippingMethod(
    @Body() dto: CreateShippingMethodDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    if (this.featureFlags.isEnabled(FeatureFlag.SHIPPING_SERVICE_LAYER)) {
      return this.shippingMethodsAdminService.createShippingMethod(dto)
    }

    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error('Name is required')
    }

    if (dto.baseCostCents < 0) {
      throw new Error('Base cost cannot be negative')
    }

    if (dto.perKgCostCents !== undefined && dto.perKgCostCents < 0) {
      throw new Error('Per-KG cost cannot be negative')
    }

    if (dto.minDeliveryDays < 1 || dto.maxDeliveryDays < 1) {
      throw new Error('Delivery days must be at least 1')
    }

    if (dto.minDeliveryDays > dto.maxDeliveryDays) {
      throw new Error('Min delivery days cannot be greater than max')
    }

    const method = await this.prisma.shippingMethod.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        baseCostCents: dto.baseCostCents,
        perKgCostCents: dto.perKgCostCents || null,
        minWeightGrams: dto.minWeightGrams || null,
        maxWeightGrams: dto.maxWeightGrams || null,
        minDeliveryDays: dto.minDeliveryDays,
        maxDeliveryDays: dto.maxDeliveryDays,
        allowedCountries: dto.supportedCountries || [],
        isActive: dto.active !== false,
      },
    })

    return method
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateShippingMethod(
    @Param('id') id: string,
    @Body() dto: UpdateShippingMethodDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    if (this.featureFlags.isEnabled(FeatureFlag.SHIPPING_SERVICE_LAYER)) {
      return this.shippingMethodsAdminService.updateShippingMethod(id, dto)
    }

    const existing = await this.prisma.shippingMethod.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Shipping method not found')
    }

    if (dto.minDeliveryDays !== undefined || dto.maxDeliveryDays !== undefined) {
      const minDays = dto.minDeliveryDays ?? existing.minDeliveryDays
      const maxDays = dto.maxDeliveryDays ?? existing.maxDeliveryDays
      if (minDays > maxDays) {
        throw new Error('Min delivery days cannot be greater than max')
      }
    }

    const updated = await this.prisma.shippingMethod.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description !== undefined ? dto.description : undefined,
        baseCostCents: dto.baseCostCents,
        perKgCostCents: dto.perKgCostCents !== undefined ? dto.perKgCostCents : undefined,
        minWeightGrams: dto.minWeightGrams !== undefined ? dto.minWeightGrams : undefined,
        maxWeightGrams: dto.maxWeightGrams !== undefined ? dto.maxWeightGrams : undefined,
        minDeliveryDays: dto.minDeliveryDays,
        maxDeliveryDays: dto.maxDeliveryDays,
        allowedCountries: dto.supportedCountries,
        isActive: dto.active,
      },
    })

    return updated
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShippingMethod(
    @Param('id') id: string,
    @GetRequestInfo() info: RequestInfo,
  ) {
    if (this.featureFlags.isEnabled(FeatureFlag.SHIPPING_SERVICE_LAYER)) {
      return this.shippingMethodsAdminService.deleteShippingMethod(id)
    }

    const existing = await this.prisma.shippingMethod.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Shipping method not found')
    }

    await this.prisma.shippingMethod.delete({ where: { id } })
  }
}
