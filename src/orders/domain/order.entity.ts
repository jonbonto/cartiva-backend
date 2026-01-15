export type OrderItem = {
  id: string
  productId: number
  productName: string
  pricePerUnitCents: number
  quantity: number
  subtotalCents: number
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class Order {
  private constructor(
    public readonly id: string,
    public readonly userId: number,
    public items: OrderItem[],
    public status: OrderStatus,
    public currency: string,
    public subtotalCents: number,
    public taxCents: number,
    public shippingCents: number,
    public createdAt: Date = new Date(),
  ) {}

  static create(params: { id: string; userId: number; items: OrderItem[]; currency: string }) {
    if (!params.items || params.items.length === 0) {
      throw new Error('Order must have at least one item')
    }

    const subtotal = params.items.reduce((s, it) => s + it.subtotalCents, 0)

    return new Order(
      params.id,
      params.userId,
      params.items,
      OrderStatus.PENDING,
      params.currency,
      subtotal,
      0,
      0,
      new Date(),
    )
  }

  static reconstitute(params: {
    id: string
    userId: number
    items: OrderItem[]
    status: OrderStatus
    currency: string
    subtotalCents: number
    taxCents: number
    shippingCents: number
    createdAt?: Date
  }) {
    return new Order(
      params.id,
      params.userId,
      params.items,
      params.status,
      params.currency,
      params.subtotalCents,
      params.taxCents,
      params.shippingCents,
      params.createdAt || new Date(),
    )
  }

  applyTax(taxCents: number) {
    if (taxCents < 0) throw new Error('Tax cannot be negative')
    this.taxCents = taxCents
  }

  applyShipping(shippingCents: number) {
    if (shippingCents < 0) throw new Error('Shipping cannot be negative')
    this.shippingCents = shippingCents
  }

  calculateTotal(): number {
    return this.subtotalCents + this.taxCents + this.shippingCents
  }

  canBeCancelled(): boolean {
    return this.status === OrderStatus.PENDING
  }

  cancel(): void {
    if (!this.canBeCancelled()) throw new Error(`Cannot cancel order in ${this.status} status`)
    this.status = OrderStatus.CANCELLED
  }
}
