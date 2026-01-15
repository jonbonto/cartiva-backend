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
