import { Order } from './order.entity'

export const ORDER_REPOSITORY = 'ORDER_REPOSITORY'

export interface OrderRepository {
  save(order: Order): Promise<void>
  findById(id: string): Promise<Order | null>
  findByUserId(userId: number): Promise<Order[]>
  // Persist a full order (accept legacy/DB-shaped order) and return DB model
  persistOrder(order: any, shippingMethodId?: string | null, shippingAddress?: any, cartId?: number): Promise<any>
  // Link reservation id to an order item
  linkReservation(orderItemId: number | string, reservationId: string): Promise<void>
  // Return raw DB order with relations (items, payment, timestamps)
  findRawById(id: string): Promise<any | null>
  // Find orders for user with pagination and selection
  findRawByUserId(userId: number, skip: number, take: number, where?: any, orderBy?: any, select?: any): Promise<{ orders: any[]; total: number }>
}
