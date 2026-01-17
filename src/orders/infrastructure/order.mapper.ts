import { Order, OrderItem, OrderStatus } from '../domain/order.entity'

export class OrderMapper {
  static toPrisma(order: Order) {
    const itemsArr = order.items || []


    const itemsCreate = itemsArr.map((it) => {
      // support multiple shapes: MoneyValue objects (`pricePerUnitAtPurchase`, `subtotal`) or direct cents fields
      const unitPrice = Number(
        (it as any).pricePerUnitCents ??
          (it as any).unitPriceCents ??
          (it as any).pricePerUnitAtPurchase?.amountCents ??
          0,
      )
      const quantity = Number((it as any).quantity ?? 0)
      const subtotal = Number(
        (it as any).subtotalAmountCents ??
          (it as any).subtotalCents ??
          (it as any).subtotal?.amountCents ??
          unitPrice * quantity,
      )

      return {
        id: String(it.id),
        productId: Number((it as any).productId ?? 0),
        productName: (it as any).productName || null,
        unitPriceCents: unitPrice,
        quantity,
        subtotalAmountCents: subtotal,
      }
    })

    const subtotalFromItems = itemsCreate.reduce((s, it) => s + (Number(it.subtotalAmountCents) || 0), 0)

    const subtotal = Number(
      (order as any).subtotalAmountCents ??
        (order as any).subtotal?.amountCents ??
        (order as any).subtotalCents ??
        subtotalFromItems ??
        0,
    )

    const tax = Number(
      (order as any).taxAmount?.amountCents ??
        (order as any).taxAmountCents ??
        (order as any).taxCents ??
        0,
    )

    const shipping = Number(
      (order as any).shippingCost?.amountCents ??
        (order as any).shippingCostCents ??
        (order as any).shippingCents ??
        0,
    )

    const discountTotal = Number(
      (order as any).discountTotal?.amountCents ??
        (order as any).discountTotalAmountCents ??
        (order as any).discountTotalCents ??
        0,
    )

    const totalBefore = Number(
      (order as any).totalBeforePayment?.amountCents ??
        (order as any).totalBeforePaymentCents ??
        (order as any).totalBeforePayment ??
        subtotal - discountTotal + tax + shipping,
    )

    const appliedDiscounts = (order as any).appliedDiscounts ?? []
    // final total stored should equal totalBeforePayment
    const finalTotal = totalBefore

    return {
      id: String(order.id),
      userId: Number((order as any).userId ?? 0),
      currency: order.currency || 'USD',
      subtotalAmountCents: subtotal,
      discountTotalAmountCents: discountTotal,
      taxAmountCents: tax,
      shippingCostCents: shipping,
      totalBeforePaymentCents: totalBefore,
      finalTotalAmountCents: finalTotal,
      appliedDiscounts,
      status: (order as any).status ?? 'PENDING',
      createdAt: order.createdAt,
      items: {
        create: itemsCreate,
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
      discountTotalCents: db.discountTotalAmountCents || 0,
      appliedDiscounts: db.appliedDiscounts || [],
      createdAt: db.createdAt ? new Date(db.createdAt) : new Date(),
    })
  }
}
