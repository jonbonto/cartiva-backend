import { Order, OrderItem, OrderStatus } from '../domain/order.entity'

export class OrderMapper {
  static toPrisma(order: Order) {
    const totalBefore = order.subtotalCents + order.taxCents + order.shippingCents

    return {
      id: order.id,
      userId: order.userId,
      currency: order.currency,
      subtotalAmountCents: order.subtotalCents,
      discountTotalAmountCents: 0,
      taxAmountCents: order.taxCents,
      shippingCostCents: order.shippingCents,
      totalBeforePaymentCents: totalBefore,
      finalTotalAmountCents: totalBefore,
      appliedDiscounts: [],
      status: order.status,
      createdAt: order.createdAt,
      items: {
        create: order.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          unitPriceCents: it.pricePerUnitCents,
          quantity: it.quantity,
          subtotalAmountCents: it.subtotalCents,
        })),
      },
    }
  }

  static toDomain(db: any): Order {
    const items: OrderItem[] = (db.items || []).map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      pricePerUnitCents: it.unitPriceCents,
      quantity: it.quantity,
      subtotalCents: it.subtotalAmountCents,
    }))

    return Order.reconstitute({
      id: db.id,
      userId: db.userId,
      items,
      status: (db.status as OrderStatus) || OrderStatus.PENDING,
      currency: db.currency,
      subtotalCents: db.subtotalAmountCents || 0,
      taxCents: db.taxAmountCents || 0,
      shippingCents: db.shippingCostCents || 0,
      createdAt: db.createdAt ? new Date(db.createdAt) : new Date(),
    })
  }
}
