import { Injectable, Inject } from '@nestjs/common'
import { ORDER_REPOSITORY, OrderRepository } from '../domain/order.repository'

@Injectable()
export class GetCustomerOrdersQuery {
  constructor(@Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository) {}

  async execute(params: {
    userId: number
    page: number
    limit: number
    status?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) {
    const { userId, page, limit, status, sortBy = 'createdAt', sortOrder = 'desc' } = params

    // Fetch all orders for user via repository and apply simple filters/pagination
    const all = await this.orderRepository.findByUserId(userId)

    let filtered = all
    if (status) {
      filtered = filtered.filter((o: any) => o.status === status)
    }

    // Simple sort only by createdAt supported at domain level
    filtered.sort((a: any, b: any) => {
      const av = new Date(a.createdAt).getTime()
      const bv = new Date(b.createdAt).getTime()
      return sortOrder === 'asc' ? av - bv : bv - av
    })

    const total = filtered.length
    const skip = (page - 1) * limit
    const paged = filtered.slice(skip, skip + limit)

    return {
      orders: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
