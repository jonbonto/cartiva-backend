import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface ReleaseReservationDto {
  reason: string
}

@Injectable()
export class InventoryReservationsAdminService {
  private readonly logger = new Logger(InventoryReservationsAdminService.name)

  constructor(private prisma: PrismaService) {}

  async listReservations(
    filters?: { productId?: string },
    sort?: { by: string; order: 'asc' | 'desc' },
    pagination?: { limit: number; offset: number }
  ) {
    try {
      const pageNum = pagination?.offset || 0
      const limitNum = pagination?.limit || 20
      const sortBy = sort?.by || 'createdAt'
      const sortOrder = sort?.order || 'desc'

      const where: any = {}
      if (filters?.productId) {
        where.productId = filters.productId
      }

      const [reservations, total] = await Promise.all([
        this.prisma.inventoryReservation.findMany({
          where,
          skip: pageNum,
          take: limitNum,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.inventoryReservation.count({ where }),
      ])

      const productIds = Array.from(new Set(reservations.map((r) => r.productId).filter(Boolean)))
      const products = productIds.length
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : []

      const productMap = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {})

      const data = reservations.map((res) => ({
        ...res,
        productName: productMap[res.productId]?.name || null,
      }))

      return {
        data,
        meta: {
          page: Math.floor(pageNum / limitNum) + 1,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      }
    } catch (error) {
      this.logger.error(`Failed to list reservations: ${error.message}`)
      throw new InternalServerErrorException('Failed to list reservations')
    }
  }

  async releaseReservation(id: string, reason?: string) {
    try {
      const reservation = await this.prisma.inventoryReservation.findUnique({ where: { id } })

      if (!reservation) {
        throw new BadRequestException('Reservation not found')
      }

      if (reservation.status !== 'RESERVED') {
        throw new BadRequestException(`Cannot release a ${reservation.status} reservation`)
      }

      this.validateReleaseReason(reason || '')

      const updated = await this.prisma.inventoryReservation.update({
        where: { id },
        data: {
          status: 'RELEASED',
          releaseReason: reason || 'MANUAL_ADMIN',
          releasedAt: new Date(),
        },
      })

      this.logger.log(`Reservation released: ${id}`)
      return updated
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      this.logger.error(`Failed to release reservation: ${error.message}`)
      throw new InternalServerErrorException('Failed to release reservation')
    }
  }

  validateReleaseReason(reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Release reason required')
    }
    return true
  }
}
