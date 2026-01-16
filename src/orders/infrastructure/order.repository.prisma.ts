import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { OrderRepository } from '../domain/order.repository'
import { Order } from '../domain/order.entity'
import { OrderMapper } from './order.mapper'

@Injectable()
export class OrderRepositoryPrisma implements OrderRepository {
  constructor(private prisma: PrismaService) {}

  async save(order: Order): Promise<void> {
    const dbModel = OrderMapper.toPrisma(order)

    // Upsert order and related items in a simple way
    await this.prisma.order.upsert({
      where: { id: dbModel.id },
      update: {
        userId: dbModel.userId,
        currency: dbModel.currency,
        subtotalAmountCents: dbModel.subtotalAmountCents,
        taxAmountCents: dbModel.taxAmountCents,
        shippingCostCents: dbModel.shippingCostCents,
        status: dbModel.status,
      },
      create: {
        id: dbModel.id,
        userId: dbModel.userId,
        currency: dbModel.currency,
        subtotalAmountCents: dbModel.subtotalAmountCents,
        discountTotalAmountCents: dbModel.discountTotalAmountCents || 0,
        taxAmountCents: dbModel.taxAmountCents,
        shippingCostCents: dbModel.shippingCostCents,
        totalBeforePaymentCents: dbModel.totalBeforePaymentCents,
        finalTotalAmountCents: dbModel.finalTotalAmountCents,
        appliedDiscounts: dbModel.appliedDiscounts || [],
        status: dbModel.status,
        items: dbModel.items,
      },
    })
  }

  async persistOrder(order: Order, shippingMethodId?: string | null, shippingAddress?: any, cartId?: number): Promise<any> {
    const dbModel = OrderMapper.toPrisma(order)

    const created = await this.prisma.order.create({
      data: {
        id: dbModel.id,
        userId: dbModel.userId,
        currency: dbModel.currency,
        subtotalAmountCents: dbModel.subtotalAmountCents,
        discountTotalAmountCents: dbModel.discountTotalAmountCents || 0,
        taxAmountCents: dbModel.taxAmountCents,
        shippingCostCents: dbModel.shippingCostCents,
        totalBeforePaymentCents: dbModel.totalBeforePaymentCents,
        finalTotalAmountCents: dbModel.finalTotalAmountCents,
        appliedDiscounts: dbModel.appliedDiscounts || [],
        status: dbModel.status,
        // expiresAt may be set elsewhere; omit if not present on mapper
        items: dbModel.items,
        shippingMethodId: shippingMethodId || null,
      },
      include: { items: true },
    })

    if (shippingAddress) {
      await this.prisma.shippingAddress.create({
        data: {
          orderId: created.id,
          fullName: shippingAddress.fullName,
          streetLine1: shippingAddress.streetLine1,
          streetLine2: shippingAddress.streetLine2,
          city: shippingAddress.city,
          stateProvince: shippingAddress.stateProvince,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
          phoneNumber: shippingAddress.phoneNumber,
        },
      })
    }

    return created
  }

  async linkReservation(orderItemId: number | string, reservationId: string): Promise<void> {
    await this.prisma.orderItem.update({ where: { id: String(orderItemId) }, data: { reservationId } }).catch(() => {})
  }

  async findRawById(id: string): Promise<any | null> {
    const db = await this.prisma.order.findUnique({ where: { id }, include: { items: true, payment: true } })
    return db || null
  }

  async findRawByUserId(userId: number, skip: number, take: number, where?: any, orderBy?: any, select?: any): Promise<{ orders: any[]; total: number }> {
    const w = Object.assign({ userId }, where || {})
    const total = await this.prisma.order.count({ where: w })
    const orders = await this.prisma.order.findMany({ where: w, select: select || undefined, orderBy: orderBy || { createdAt: 'desc' }, skip, take })
    return { orders, total }
  }

  async findById(id: string): Promise<Order | null> {
    const db = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!db) return null
    return OrderMapper.toDomain(db)
  }

  async findByUserId(userId: number): Promise<Order[]> {
    const dbs = await this.prisma.order.findMany({ where: { userId }, include: { items: true } })
    return dbs.map((d) => OrderMapper.toDomain(d))
  }
}
