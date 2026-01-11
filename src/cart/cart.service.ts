import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CartResponseDto } from './dto/cart-response.dto'

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get or create cart, always return full cart with computed totals
   */
  async getCartBySession(sessionId: string): Promise<CartResponseDto> {
    let cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: { include: { product: true } } }
    })

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { sessionId },
        include: { items: { include: { product: true } } }
      })
    }

    return this.mapToResponseDto(cart)
  }

  /**
   * Add item or increment quantity, return full cart
   */
  async addItem(sessionId: string, productId: number, quantity: number): Promise<CartResponseDto> {
    const cart = await this.getCartBySession(sessionId)

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId }
    })

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity }
      })
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity }
      })
    }

    // Update cart activity
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { lastActivityAt: new Date() }
    })

    return this.getCartBySession(sessionId)
  }

  /**
   * Update item quantity or delete if quantity <= 0, return full cart
   */
  async updateItem(cartId: number, itemId: number, quantity: number): Promise<CartResponseDto> {
    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } })
    } else {
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } })
    }

    // Update cart activity
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { lastActivityAt: new Date() }
    })

    // Fetch full cart
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } }
    })

    return this.mapToResponseDto(cart!)
  }

  /**
   * Remove item, return full cart
   */
  async removeItem(cartId: number, itemId: number): Promise<CartResponseDto> {
    await this.prisma.cartItem.delete({ where: { id: itemId } })

    // Update cart activity
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { lastActivityAt: new Date() }
    })

    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } }
    })

    return this.mapToResponseDto(cart!)
  }

  /**
   * Mark cart as checked out — prevents reuse
   * Called after order creation
   */
  async markCartAsCheckedOut(cartId: number): Promise<void> {
    // Delete cart and all items (soft delete alternative: add checkedOutAt timestamp)
    await this.prisma.cartItem.deleteMany({ where: { cartId } })
    await this.prisma.cart.delete({ where: { id: cartId } })
  }

  /**
   * Map Prisma cart to response DTO with computed totals
   */
  private mapToResponseDto(cart: any): CartResponseDto {
    const totalQuantity = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const totalPriceInCents = cart.items.reduce(
      (sum: number, item: any) => sum + item.product.priceInCents * item.quantity,
      0
    )

    return {
      id: cart.id,
      sessionId: cart.sessionId,
      items: cart.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          priceInCents: item.product.priceInCents,
          imageUrl: item.product.imageUrl
        }
      })),
      totalQuantity,
      totalPriceInCents
    }
  }
}
