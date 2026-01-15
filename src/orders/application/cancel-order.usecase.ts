import { Injectable, Inject, BadRequestException, ForbiddenException } from '@nestjs/common'
import { ORDER_REPOSITORY } from '../domain/order.repository'
import { OrderRepository } from '../domain/order.repository'

@Injectable()
export class CancelOrderUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository) {}

  async execute(command: { orderId: string; userId: number }) {
    const { orderId, userId } = command

    const order = await this.orderRepository.findById(orderId)
    if (!order) throw new BadRequestException(`Order not found: ${orderId}`)

    if (order.userId !== userId) {
      throw new ForbiddenException('Not authorized to cancel this order')
    }

    if (!order.canBeCancelled()) {
      throw new BadRequestException(`Order cannot be cancelled in status ${order.status}`)
    }

    order.cancel()

    await this.orderRepository.save(order)

    return order
  }
}
