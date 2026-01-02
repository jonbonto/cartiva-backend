/**
 * Cart response DTO — single source of truth for cart state
 * Backend ALWAYS computes totals — frontend NEVER does math
 */
export class CartItemDto {
  id: number
  productId: number
  quantity: number
  product: {
    id: number
    name: string
    priceInCents: number
    imageUrl?: string
  }
}

export class CartResponseDto {
  id: number
  sessionId: string
  items: CartItemDto[]
  totalQuantity: number
  totalPriceInCents: number
}
