import { Injectable, Inject } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Order, OrderItem, OrderStatus } from '../domain/order.entity'
import { OrderRepository } from '../domain/order.repository'
import { ShippingAddress } from '../../shipping/domain/shipping.service'
import { TaxService } from '../../tax/domain/tax.service'
import { ShippingService } from '../../shipping/domain/shipping.service'
import { ORDER_REPOSITORY } from '../domain/order.repository'
import { OrdersService } from '../orders.service'

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository,
    private taxService: TaxService,
    private shippingService: ShippingService,
    private ordersService: OrdersService,
  ) {}
  async execute(command: {
    userId: number
    currency: string
    cartId?: number
    items?: Array<{ productId: number; name: string; priceCents: number; quantity: number }>
    address?: { country?: string; state?: string; city?: string }
    shippingMethodId?: string
    discountCodes?: string[]
  }) {
    // If a cartId is provided, delegate to legacy OrdersService which handles cart snapshotting
    if (command.cartId) {
      const legacy: any = await this.ordersService.createOrderFromCart(
        command.cartId,
        command.userId,
        {
          cartId: command.cartId,
          currency: command.currency,
          shippingAddress: command.address,
          shippingMethodId: command.shippingMethodId,
          discountCodes: command.discountCodes,
        } as any,
      )

      // Map legacy order to domain Order
      const items: OrderItem[] = (legacy.items || []).map((it: any) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        pricePerUnitCents: it.pricePerUnitAtPurchase?.amountCents || it.unitPriceCents || 0,
        quantity: it.quantity,
        subtotalCents: it.subtotal?.amountCents || it.subtotalAmountCents || 0,
      }))

      return Order.reconstitute({
        id: legacy.id,
        userId: parseInt(legacy.userId as any) || command.userId,
        items,
        status: (legacy.status as OrderStatus) || OrderStatus.PENDING,
        currency: legacy.currency,
        subtotalCents: legacy.subtotal?.amountCents || legacy.subtotalAmountCents || 0,
        taxCents: legacy.taxAmount?.amountCents || legacy.taxAmountCents || 0,
        shippingCents: legacy.shippingCost?.amountCents || legacy.shippingCostCents || 0,
        discountTotalCents: legacy.discountTotal?.amountCents || legacy.discountTotalAmountCents || 0,
        appliedDiscounts: legacy.appliedDiscounts || [],
        createdAt: legacy.createdAt,
      })
    }

    // Default path: items provided directly
    const items: OrderItem[] = command.items.map((it, idx) => ({
      id: `item_${idx}_${Date.now()}`,
      productId: it.productId,
      productName: it.name,
      pricePerUnitCents: it.priceCents,
      quantity: it.quantity,
      subtotalCents: it.priceCents * it.quantity,
    }))

    const order = Order.create({ id: uuidv4(), userId: command.userId, items, currency: command.currency })

    // Calculate tax via domain tax service
    const addr: ShippingAddress = {
      country: command.address?.country || '',
      state: command.address?.state,
      city: command.address?.city,
      postalCode: (command.address as any)?.postalCode,
    }

    const tax = await this.taxService.calculateTax(addr, order.subtotalCents)
    order.applyTax(tax)

    // Calculate shipping via domain shipping service if provided
    if (command.shippingMethodId) {
      const shipping = await this.shippingService.calculateShipping(addr, command.shippingMethodId, 0)
      order.applyShipping(shipping)
    }

    await this.orderRepository.save(order)

    return order
  }
}
