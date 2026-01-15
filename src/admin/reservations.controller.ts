import {
  Controller,
  Get,
  Patch,
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
import { FeatureFlagsService, FeatureFlag } from '../feature-flags/feature-flags.service'
import { InventoryReservationsAdminService } from './services/inventory-reservations-admin.service'
import { GetRequestInfo, RequestInfo } from '../common/decorators/request-info.decorator'

export interface ReleaseReservationDto {
  reason: string
}

@Controller('api/admin/reservations')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ReservationsController {
  constructor(
    private inventoryReservationsAdminService: InventoryReservationsAdminService,
    private featureFlags: FeatureFlagsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getReservations(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (orderId) {
      where.orderId = { contains: orderId }
    }

    if (this.featureFlags.isEnabled(FeatureFlag.INVENTORY_RESERVATION_V2)) {
      return this.inventoryReservationsAdminService.listReservations(undefined, { by: 'createdAt', order: 'desc' }, { limit: limitNum, offset: skip })
    }

    const [reservations, total] = await Promise.all([
      this.prisma.inventoryReservation.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryReservation.count({ where }),
    ])

    // Enrich with product names
    const productIds = Array.from(new Set(reservations.map((r) => r.productId).filter(Boolean))) as number[]
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : []
    const productMap = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<number, { id: number; name: string }>)

    const data = reservations.map((res) => ({
      ...res,
      productName: productMap[res.productId]?.name || null,
    }))

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    }
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getReservationStats() {
    if (this.featureFlags.isEnabled(FeatureFlag.INVENTORY_RESERVATION_V2)) {
      return this.inventoryReservationsAdminService.listReservations(undefined, undefined, { limit: 0, offset: 0 })
    }

    const [
      total,
      reserved,
      confirmed,
      released,
      expired,
    ] = await Promise.all([
      this.prisma.inventoryReservation.count(),
      this.prisma.inventoryReservation.count({ where: { status: 'RESERVED' } }),
      this.prisma.inventoryReservation.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.inventoryReservation.count({ where: { status: 'RELEASED' } }),
      this.prisma.inventoryReservation.count({ where: { status: 'EXPIRED' } }),
    ])

    // Calculate expiringIn24h
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const expiringIn24h = await this.prisma.inventoryReservation.count({
      where: {
        status: 'RESERVED',
        expiresAt: {
          lte: in24h,
        },
      },
    })

    // Calculate total reserved value
    const reservedItems = await this.prisma.inventoryReservation.findMany({
      where: { status: 'RESERVED' },
      select: { productId: true, quantity: true },
    })

    const reservedProductIds = Array.from(new Set(reservedItems.map((r) => r.productId).filter(Boolean))) as number[]
    const reservedProducts = reservedProductIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: reservedProductIds } }, select: { id: true, priceInCents: true } })
      : []
    const priceMap = reservedProducts.reduce((acc, p) => ({ ...acc, [p.id]: p.priceInCents }), {} as Record<number, number>)

    const totalReservedValue = reservedItems.reduce((sum, item) => {
      const price = priceMap[item.productId] || 0
      const itemValue = price * (item.quantity || 1)
      return sum + itemValue
    }, 0)

    return {
      totalReservations: total,
      reservedCount: reserved,
      confirmedCount: confirmed,
      releasedCount: released,
      expiredCount: expired,
      expiringIn24h,
      totalReservedValue,
    }
  }

  @Patch(':id/release')
  @HttpCode(HttpStatus.OK)
  async releaseReservation(
    @Param('id') id: string,
    @Body() dto: ReleaseReservationDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    if (this.featureFlags.isEnabled(FeatureFlag.INVENTORY_RESERVATION_V2)) {
      return this.inventoryReservationsAdminService.releaseReservation(id, dto.reason)
    }

    const reservation = await this.prisma.inventoryReservation.findUnique({ where: { id } })

    if (!reservation) {
      throw new Error('Reservation not found')
    }

    if (reservation.status !== 'RESERVED') {
      throw new Error(`Cannot release a ${reservation.status} reservation`)
    }

    const updated = await this.prisma.inventoryReservation.update({
      where: { id },
      data: {
        status: 'RELEASED',
        releaseReason: dto.reason || 'MANUAL_ADMIN',
        releasedAt: new Date(),
      },
    })

    return updated
  }
}
