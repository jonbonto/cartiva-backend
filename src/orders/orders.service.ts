import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Inject } from '@nestjs/common'
import { ORDER_REPOSITORY, OrderRepository } from './domain/order.repository'
import { CartService } from '../cart/cart.service'
import { ProductsService } from '../products/products.service'
import { TaxService } from '../tax/domain/tax.service'
import { ShippingService } from '../shipping/domain/shipping.service'
import { InventoryReservationService } from '../services/inventory/inventory-reservation.service'
import { CreateOrderDto } from './dto/order.dto'
import { Order as OrderType, OrderValidator } from '../common/types/order'
import { DiscountEngine, DiscountRule } from '../common/types/discount'
import { MoneyValue } from '../common/types/money'

/**
 * PHASE 6: OrderService (updated)
 * 
 * Responsibilities:
 * - Create immutable order from cart
 * - Apply discounts deterministically
 * - Calculate tax and shipping (NEW - Phase 6)
 * - Create inventory reservations (NEW - Phase 6)
 * - Save shipping address (NEW - Phase 6)
 * - Validate order before payment
 * - Lock cart after checkout
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private productsService: ProductsService,
    private taxService: TaxService,
    private shippingService: ShippingService,
    private inventoryReservationService: InventoryReservationService,
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository,
  ) {}


  /**
   * Create an order from cart
   * 
   * - Validates cart exists and is fresh
   * - Snapshots product prices at purchase time
   * - Applies discounts
   * - Validates totals
   * - Locks cart so it cannot be reused
   * 
   * @param cartId Cart to checkout
   * @param userId User ID (required - authenticated users only)
   * @param createOrderDto Currency and discount codes
   * @returns Created order
   */
  async createOrderFromCart(
    cartId: number,
    userId: number,
    createOrderDto: CreateOrderDto
  ): Promise<OrderType> {
    // 1. Fetch cart with items
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    })

    if (!cart) {
      throw new BadRequestException(`Cart not found: ${cartId}`)
    }

    if (cart.items.length === 0) {
      throw new BadRequestException('Cannot checkout empty cart')
    }

    // 2. Validate all products are still active and in stock
    for (const item of cart.items) {
      if (!item.product.isActive) {
        throw new BadRequestException(
          `Product "${item.product.name}" is no longer available`
        )
      }

      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}, Requested: ${item.quantity}`
        )
      }
    }

    // 3. Build order items (snapshot prices)
    const orderItems = cart.items.map((item) => ({
      id: `item_${item.id}`,
      productId: item.product.id,
      productName: item.product.name,
      pricePerUnitAtPurchase: new MoneyValue(item.product.priceInCents, createOrderDto.currency as any),
      quantity: item.quantity,
      subtotal: new MoneyValue(
        item.product.priceInCents * item.quantity,
        createOrderDto.currency as any
      ),
    }))

    // 4. Calculate subtotal
    const subtotalCents = orderItems.reduce((sum, item) => sum + item.subtotal.amountCents, 0)
    const subtotal = new MoneyValue(subtotalCents, createOrderDto.currency as any)

    // 5. Apply discounts if provided
    let appliedDiscounts = []
    let discountTotal = new MoneyValue(0, createOrderDto.currency as any)

    if (createOrderDto.discountCodes && createOrderDto.discountCodes.length > 0) {
      const discountRules = await this.prisma.discountRule.findMany({
        where: {
          code: { in: createOrderDto.discountCodes },
          isActive: true,
        },
      })

      if (discountRules.length !== createOrderDto.discountCodes.length) {
        throw new BadRequestException('One or more discount codes not found or inactive')
      }

      // Convert to domain types
      const domainRules = discountRules.map((r) => ({
        id: r.id,
        code: r.code,
        type: r.type as 'percentage' | 'fixed_amount',
        value: r.value,
        appliesTo: r.appliesTo as 'cart_wide' | 'specific_product' | 'category',
        targetProductIds: r.targetProductIds,
        minCartValue: r.minCartValueCents
          ? { amountCents: r.minCartValueCents, currency: createOrderDto.currency as any }
          : undefined,
        maxUsageCount: r.maxUsageCount,
        usageCount: r.usageCount,
        isStackable: r.isStackable,
        priority: r.priority,
        isActive: r.isActive,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))

      // Apply discount engine
      const appliedDiscountApps = DiscountEngine.applyDiscounts(
        cart.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          product: {
            id: item.product.id,
            name: item.product.name,
            priceInCents: item.product.priceInCents,
            imageUrl: item.product.imageUrl,
          },
        })),
        domainRules,
        createOrderDto.currency as any
      )

      appliedDiscounts = appliedDiscountApps.map((app) => ({
        id: app.ruleId,
        code: app.code,
        type: app.code ? 'code' : 'automatic',
        amountDeducted: app.amountDeducted,
        reason: app.reason,
      }))

      discountTotal = appliedDiscountApps.reduce(
        (sum, app) => sum.add(app.amountDeducted),
        new MoneyValue(0, createOrderDto.currency as any)
      )
    }

    // 6. Calculate tax and shipping (Phase 6)
    let taxAmountCents = 0
    let shippingCostCents = 0
    let shippingMethodId: string | null = null

    // Calculate tax if shipping address provided
    if (createOrderDto.shippingAddress) {
      taxAmountCents = await this.taxService.calculateTax(
        {
          country: createOrderDto.shippingAddress.country,
          state: createOrderDto.shippingAddress.stateProvince,
          city: createOrderDto.shippingAddress.city,
        },
        subtotalCents
      )
    }

    // Calculate shipping if shipping method provided
    if (createOrderDto.shippingMethodId && createOrderDto.shippingAddress) {
      shippingCostCents = await this.shippingService.calculateShipping(
        {
          country: createOrderDto.shippingAddress.country,
          state: createOrderDto.shippingAddress.stateProvince,
          city: createOrderDto.shippingAddress.city,
          postalCode: createOrderDto.shippingAddress.postalCode,
        },
        createOrderDto.shippingMethodId,
        createOrderDto.estimatedWeight || 0
      )
      shippingMethodId = createOrderDto.shippingMethodId
    }

    const taxAmount = new MoneyValue(taxAmountCents, createOrderDto.currency as any)
    const shippingCost = new MoneyValue(shippingCostCents, createOrderDto.currency as any)

    const totalBeforePayment = subtotal
      .subtract(discountTotal)
      .add(taxAmount)
      .add(shippingCost)

    // 7. Build order object
    const order: OrderType = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId.toString(),
      currency: createOrderDto.currency as 'USD' | 'EUR' | 'GBP' | 'JPY' | 'IDR',
      items: orderItems,
      subtotal,
      appliedDiscounts: appliedDiscounts as any,
      discountTotal,
      taxAmount,
      shippingCost,
      totalBeforePayment,
      finalTotal: totalBeforePayment, // Same as totalBeforePayment for now
      createdAt: new Date(),
    }

    // 8. Validate order integrity
    OrderValidator.validate(order)

    // Debug logging: show calculated money values before persist
    try {
      this.logger.log(`Checkout amounts — subtotal: ${JSON.stringify(subtotal)}, discountTotal: ${JSON.stringify(discountTotal)}, taxAmount: ${JSON.stringify(taxAmount)}, shippingCost: ${JSON.stringify(shippingCost)}, totalBeforePayment: ${JSON.stringify(totalBeforePayment)}`)
    } catch (e) {
      // ignore logging errors
    }

    // 9. Persist order with shipping address and create inventory reservations
    const persistedOrder = await this.persistOrder(
      order,
      shippingMethodId,
      createOrderDto.shippingAddress,
      cartId
    )

    // 10. Mark cart as checked out (can't be reused)
    await this.cartService.markCartAsCheckedOut(cartId)

    return order
  }

  /**
   * Persist order to database
   * Also saves shipping address and creates inventory reservations
   */
  private async persistOrder(
    order: OrderType,
    shippingMethodId?: string | null,
    shippingAddress?: any,
    cartId?: number
  ) {
    try {
      const dbOrder = await this.orderRepository.persistOrder(order, shippingMethodId, shippingAddress, cartId)

      // Create inventory reservations for each order item (Phase 6)
      for (const item of dbOrder.items) {
        try {
          const reservation = await this.inventoryReservationService.createReservation(
            item.productId,
            item.quantity,
            dbOrder.id,
            item.id
          )

          // Link reservation to order item via repository
          await this.orderRepository.linkReservation(item.id, reservation.id)
        } catch (error) {
          // Log reservation error but don't fail the entire order
          console.error(`Failed to create reservation for item ${item.id}:`, error.message)
        }
      }

      return dbOrder
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create order: ${error.message}`
      )
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, userId?: number) {
    const order = await this.orderRepository.findRawById(orderId)
    if (!order) {
      throw new BadRequestException(`Order not found: ${orderId}`)
    }

    if (userId && order.userId !== userId) {
      throw new BadRequestException('Unauthorized')
    }

    return order
  }

  /**
   * Deduct stock for order (called after payment succeeds)
   * This must be atomic — either all succeed or all fail
   */
  async deductStockForOrder(orderId: string): Promise<void> {
    const order = await this.orderRepository.findRawById(orderId)

    if (!order) {
      throw new BadRequestException(`Order not found: ${orderId}`)
    }

    try {
      // Use transaction for atomicity
      await this.prisma.$transaction(
        order.items.map((item: any) =>
          this.prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          })
        )
      )
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to deduct stock: ${error.message}`
      )
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status,
          paidAt: status === 'PAID' ? new Date() : undefined,
        },
      })
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to update order status: ${error.message}`
      )
    }
  }

  /**
   * Get customer's orders with pagination (PHASE 7)
   * 
   * @param params - Query parameters
   * @returns Paginated order list
   */
  async getCustomerOrders(params: {
    userId: number
    page: number
    limit: number
    status?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) {
    const { userId, page, limit, status, sortBy = 'createdAt', sortOrder = 'desc' } = params

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { userId }
    if (status) {
      where.status = status
    }

    const { orders, total } = await this.orderRepository.findRawByUserId(userId, skip, limit, where, { [sortBy]: sortOrder }, {
      id: true,
      currency: true,
      status: true,
      fulfillmentStatus: true,
      finalTotalAmountCents: true,
      createdAt: true,
      paidAt: true,
      shippedAt: true,
      deliveredAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          unitPriceCents: true,
          subtotalAmountCents: true,
        },
      },
    })

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
