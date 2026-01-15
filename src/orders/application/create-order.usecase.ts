import { Injectable, Inject } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Order, OrderItem } from '../domain/order.entity'
import { OrderRepository } from '../domain/order.repository'
import { ShippingAddress } from '../../shipping/domain/shipping.service'
import { TaxService } from '../../tax/domain/tax.service'
import { ShippingService } from '../../shipping/domain/shipping.service'
import { ORDER_REPOSITORY } from '../domain/order.repository'

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository,
    private taxService: TaxService,
    private shippingService: ShippingService,
  ) {}

  async execute(command: {
    userId: number
    currency: string
    items: Array<{ productId: number; name: string; priceCents: number; quantity: number }>
    address?: { country?: string; state?: string; city?: string }
    shippingMethodId?: string
  }) {
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
