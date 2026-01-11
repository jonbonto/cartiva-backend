/**
 * PHASE 4: Quick Reference - Extensibility Architecture
 * 
 * For developers: How to extend the system with new features
 */

# PHASE 4 — QUICK REFERENCE

## Adding a New Payment Provider

### 1. Create Provider Implementation

File: `src/payment-providers/stripe.provider.ts`

```typescript
import { PaymentProvider, PaymentIntent, PaymentResult } from '@/common/types/payment'
import { Order } from '@/common/types/order'

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe'

  async createPayment(order: Order): Promise<PaymentIntent> {
    // Call Stripe API with order data
    // Map response to normalized PaymentIntent
    return {
      id: chargeId,
      orderId: order.id,
      status: 'pending',
      amount: order.finalTotal,
      clientSecret: secretKey,
      metadata: { /* provider specific */ }
    }
  }

  async verifyWebhookSignature(payload: string, sig: string): Promise<boolean> {
    // Use stripe.webhooks.constructEvent()
  }

  async parseWebhookPayload(payload: string): Promise<PaymentResult> {
    // Parse and normalize
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResult> {
    // Call Stripe refund API
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    // Check Stripe status
  }
}
```

### 2. Register Provider

File: `src/payment/payment.module.ts`

```typescript
import { PaymentProviderRegistry } from '@/common/types/payment'
import { StripePaymentProvider } from '@/payment-providers/stripe.provider'

@Module({
  providers: [PaymentProviderRegistry],
})
export class PaymentModule {
  constructor(private registry: PaymentProviderRegistry) {
    const stripe = new StripePaymentProvider(process.env.STRIPE_API_KEY)
    this.registry.register(stripe)
  }
}
```

### 3. Use in Checkout

```typescript
const provider = this.registry.getProvider('stripe')
const payment = await provider.createPayment(order)
// Done! Payment is normalized and provider-agnostic
```

---

## Adding a Discount Rule

### 1. Define Rule

```typescript
const rule: DiscountRule = {
  id: 'summer2025',
  code: 'SUMMER15',
  type: 'percentage',
  value: 15,
  appliesTo: 'cart_wide',
  priority: 100,
  isStackable: true,
  isActive: true,
}
```

### 2. Apply During Checkout

```typescript
const rules = await discountService.findApplicableRules()
const applied = DiscountEngine.applyDiscounts(cart.items, rules, 'USD')
// applied: [{ ruleId, amountDeducted, reason }]
```

### 3. Store in Order

```typescript
const order = await orderService.create({
  cartId: cart.id,
  appliedDiscounts: applied,
})
// order.discountTotal = sum of all discounts
```

---

## Adding Multi-Currency Support

### 1. Create Cart in Currency

```typescript
// Frontend selects currency
const cart = await cartService.createCart(sessionId, 'USD')
// cart.currency = 'USD'
```

### 2. All Prices Use That Currency

```typescript
// All cart items computed in USD
cart.totalPriceInCents // In cents (e.g., 1999 for $19.99)

// Create order in same currency
const order = await orderService.create({
  cartId: cart.id,
  currency: 'USD',
})
```

### 3. Money Type Prevents Mistakes

```typescript
// This will FAIL (good!)
const usd = new MoneyValue(1999, 'USD')
const jpy = new MoneyValue(1000, 'JPY')
usd.add(jpy) // Error: Cannot add JPY to USD

// Required: Use ExchangeRateService
const rate = await exchangeRateService.getRate('USD', 'JPY')
const converted = new MoneyValue(Math.round(1999 * rate), 'JPY')
```

---

## Understanding Money Type

### Creating Money

```typescript
const price = new MoneyValue(1999, 'USD') // $19.99
const price = new MoneyValue(100000, 'IDR') // Rp100,000
const price = new MoneyValue(1000, 'JPY') // ¥1000
```

### Operations

```typescript
// Safe: Same currency
const p1 = new MoneyValue(1000, 'USD')
const p2 = new MoneyValue(500, 'USD')
p1.add(p2) // Returns MoneyValue(1500, 'USD')

// Unsafe: Different currency — THROWS ERROR
const usd = new MoneyValue(1000, 'USD')
const eur = new MoneyValue(1000, 'EUR')
usd.add(eur) // Error!

// Multiply
p1.multiply(3) // MoneyValue(3000, 'USD')

// Display
p1.toString() // "$10.00"
```

---

## Order Immutability

### Creating Order

```typescript
const order = await orderService.create(cart)
// order.finalTotal = $19.75
// order.createdAt = now
```

### After Creation — NO CHANGES

❌ Cannot update items
❌ Cannot update prices
❌ Cannot update discounts
✅ Can update payment status (separate Payment entity)

### Why

Price must not change between checkout and payment.
Audit trail must be immutable.
Prevents race conditions with stock.

---

## Provider-Agnostic Design

### Before (Tight Coupling)

```typescript
// Order knows about Stripe 😱
interface Order {
  stripeChargeId: string
  stripeFees: Money
}

// Adding Midtrans requires refactoring Order
```

### After (Abstraction)

```typescript
// Order is generic
interface Order {
  id: string
  items: OrderItem[]
  finalTotal: Money
  // NO provider-specific fields
}

// Payment is separate
interface Payment {
  id: string
  orderId: string
  providerId: string // 'stripe' | 'midtrans' | etc.
  externalId: string // Provider's payment ID
  status: PaymentStatus
}

// Adding Midtrans: Just implement PaymentProvider interface
// NO Order changes needed
```

---

## Common Patterns

### Validate Before Creating Order

```typescript
// Order validation is built-in
const order = await orderService.create(cart)
// Internally calls: OrderValidator.validate(order)
// If invalid: throws Error
```

### Apply Discounts

```typescript
const rules = await discountService.findByCodes(['SUMMER15', 'FREE5'])
const applied = DiscountEngine.applyDiscounts(cart.items, rules, 'USD')
// Returns: [{ ruleId, amountDeducted, reason }, ...]
```

### Handle Payment Webhook

```typescript
app.post('/webhooks/:provider', async (req) => {
  const provider = registry.getProvider(req.params.provider)
  
  // Verify signature
  const isValid = await provider.verifyWebhookSignature(
    req.rawBody,
    req.header('signature')
  )
  if (!isValid) throw new Error('Invalid signature')
  
  // Parse normalized result
  const result = await provider.parseWebhookPayload(req.rawBody)
  
  // Update order
  const order = await orderService.findById(result.orderId)
  await orderService.updatePaymentStatus(order.id, result.status)
})
```

---

## Extension Checklist

### Adding Payment Provider ✅

- [ ] Implement `PaymentProvider` interface
- [ ] Handle provider's webhook signature
- [ ] Map provider status → normalized `PaymentStatus`
- [ ] Register in `PaymentProviderRegistry`
- [ ] Test with mock provider first

### Adding Currency 🔜

- [ ] Update `CurrencyCode` type
- [ ] Add exchange rate service (if needed)
- [ ] Test with `MoneyValue` operations

### Adding Discount Type 🔜

- [ ] Define new `DiscountRule.appliesTo`
- [ ] Update `DiscountEngine.filterApplicableRules()`
- [ ] Add validation in `DiscountValidator`
- [ ] Test with existing engine

### Adding Shipping/Tax (Phase 5) 🔜

- [ ] Update `Order` interface (placeholder fields exist)
- [ ] Create `ShippingService` / `TaxService`
- [ ] Call before `OrderValidator.validate()`
- [ ] No changes to payment flow

---

## Testing

### Unit Test: Money Type

```typescript
it('should prevent cross-currency operations', () => {
  const usd = new MoneyValue(1999, 'USD')
  const eur = new MoneyValue(1999, 'EUR')
  expect(() => usd.add(eur)).toThrow('Cannot add EUR to USD')
})
```

### Unit Test: Discount Engine

```typescript
it('should apply discounts in priority order', () => {
  const cart = [{ product: { priceInCents: 1000 }, quantity: 1 }]
  const rules = [
    { id: '1', type: 'percentage', value: 10, priority: 50 },
    { id: '2', type: 'fixed_amount', value: 50, priority: 100 }
  ]
  const result = DiscountEngine.applyDiscounts(cart, rules, 'USD')
  expect(result[0].ruleId).toBe('2') // Higher priority first
})
```

### Integration Test: Checkout Flow

```typescript
it('should create immutable order', async () => {
  const cart = await cartService.getCart(sessionId)
  const order = await orderService.create(cart)
  
  // Order is locked
  expect(order.finalTotal).toBeDefined()
  expect(order.createdAt).toBeDefined()
})
```

### E2E Test: Payment Processing

```typescript
it('should process Stripe payment', async () => {
  const order = await orderService.create(cart)
  const stripe = registry.getProvider('stripe')
  const payment = await stripe.createPayment(order)
  
  expect(payment.status).toBe('pending')
  expect(payment.orderId).toBe(order.id)
})
```

---

## Status

✅ **Phase 4 Design Complete**
- Money type object
- Order domain model
- Payment provider abstraction
- Discount engine
- Multi-currency strategy

🔜 **Phase 5: Implementation**
- OrderService
- OrderPaymentService
- Payment webhook handlers
- Database schema updates

---

**Last Updated:** January 11, 2026
**Maintainer:** Principal Engineer
**Next Review:** After Phase 4 implementation
