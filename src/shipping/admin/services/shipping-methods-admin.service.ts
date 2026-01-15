import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'

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

@Injectable()
export class ShippingMethodsAdminService {
  private readonly logger = new Logger(ShippingMethodsAdminService.name)

  constructor(private prisma: PrismaService) {}

  async listShippingMethods(
    filters?: { country?: string },
    sort?: { by: string; order: 'asc' | 'desc' },
    pagination?: { limit: number; offset: number }
  ) {
    try {
      const pageNum = pagination?.offset || 0
      const limitNum = pagination?.limit || 20
      const sortBy = sort?.by || 'name'
      const sortOrder = sort?.order || 'asc'

      const [methods, total] = await Promise.all([
        this.prisma.shippingMethod.findMany({
          orderBy: { [sortBy]: sortOrder },
          take: limitNum,
          skip: pageNum,
        }),
        this.prisma.shippingMethod.count(),
      ])

      return {
        data: methods,
        meta: {
          page: Math.floor(pageNum / limitNum) + 1,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      }
    } catch (error) {
      this.logger.error(`Failed to list shipping methods: ${error.message}`)
      throw new InternalServerErrorException('Failed to list shipping methods')
    }
  }

  async createShippingMethod(dto: CreateShippingMethodDto) {
    try {
      this.validateShippingMethodData(dto)

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

      this.logger.log(`Shipping method created: ${method.id}`)
      return method
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to create shipping method: ${error.message}`)
      throw new InternalServerErrorException('Failed to create shipping method')
    }
  }

  async updateShippingMethod(id: string, dto: UpdateShippingMethodDto) {
    try {
      const existing = await this.prisma.shippingMethod.findUnique({ where: { id } })
      if (!existing) {
        throw new BadRequestException('Shipping method not found')
      }

      if (dto.minDeliveryDays !== undefined || dto.maxDeliveryDays !== undefined) {
        const minDays = dto.minDeliveryDays ?? existing.minDeliveryDays
        const maxDays = dto.maxDeliveryDays ?? existing.maxDeliveryDays
        if (minDays > maxDays) {
          throw new BadRequestException('Min delivery days cannot be greater than max')
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

      this.logger.log(`Shipping method updated: ${id}`)
      return updated
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to update shipping method: ${error.message}`)
      throw new InternalServerErrorException('Failed to update shipping method')
    }
  }

  async deleteShippingMethod(id: string) {
    try {
      const existing = await this.prisma.shippingMethod.findUnique({ where: { id } })
      if (!existing) {
        throw new BadRequestException('Shipping method not found')
      }

      await this.prisma.shippingMethod.delete({ where: { id } })
      this.logger.log(`Shipping method deleted: ${id}`)
      return { success: true }
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to delete shipping method: ${error.message}`)
      throw new InternalServerErrorException('Failed to delete shipping method')
    }
  }

  validateShippingMethodData(data: any) {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Name is required')
    }

    if (data.baseCostCents < 0) {
      throw new BadRequestException('Base cost cannot be negative')
    }

    if (data.perKgCostCents !== undefined && data.perKgCostCents < 0) {
      throw new BadRequestException('Per-KG cost cannot be negative')
    }

    if (data.minDeliveryDays < 1 || data.maxDeliveryDays < 1) {
      throw new BadRequestException('Delivery days must be at least 1')
    }

    if (data.minDeliveryDays > data.maxDeliveryDays) {
      throw new BadRequestException('Min delivery days cannot be greater than max')
    }

    return true
  }
}
