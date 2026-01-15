import { Order } from './order.entity'

export const ORDER_REPOSITORY = 'ORDER_REPOSITORY'

export interface OrderRepository {
  save(order: Order): Promise<void>
  findById(id: string): Promise<Order | null>
  findByUserId(userId: number): Promise<Order[]>
}
