import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCartBySession(sessionId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: { include: { product: true } } }
    })
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { sessionId } , include: { items: { include: { product: true } } } })
    }
    return cart
  }

  async addItem(sessionId: string, productId: number, qty: number) {
    const cart = await this.getCartBySession(sessionId)
    const existing = await this.prisma.cartItem.findFirst({ where: { cartId: cart.id, productId } })
    if (existing) {
      return this.prisma.cartItem.update({ where: { id: existing.id }, data: { qty: existing.qty + qty }, include: { product: true } })
    }
    return this.prisma.cartItem.create({ data: { cartId: cart.id, productId, qty }, include: { product: true } })
  }

  async updateItem(itemId: number, qty: number) {
    if (qty <= 0) {
      return this.prisma.cartItem.delete({ where: { id: itemId }, include: { product: true } })
    }
    return this.prisma.cartItem.update({ where: { id: itemId }, data: { qty }, include: { product: true } })
  }

  async removeItem(itemId: number) {
    return this.prisma.cartItem.delete({ where: { id: itemId } })
  }
}
