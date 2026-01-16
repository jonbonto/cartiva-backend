import { Injectable, Inject, BadRequestException } from '@nestjs/common'
import { ORDER_REPOSITORY, OrderRepository } from '../domain/order.repository'

@Injectable()
export class GetOrderQuery {
  constructor(@Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository) {}

  async execute(orderId: string, userId?: number) {
    const order = await this.orderRepository.findById(orderId)
    if (!order) throw new BadRequestException(`Order not found: ${orderId}`)

    if (userId && order.userId !== userId) {
      throw new BadRequestException('Unauthorized')
    }

    return order
  }
}
