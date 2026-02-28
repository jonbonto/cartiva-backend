/**
 * PHASE 4: Extensibility Architecture Document
 * 
 * This document defines the extensibility strategy for Phase 4+.
 * It shows how the system is designed to support new features WITHOUT requiring
 * changes to core domain logic.
 */

# PHASE 4 — EXTENSIBILITY STRATEGY

## Executive Summary

Post-Phase 3, the system has:
- ✅ Hardened fundamentals (price types, cart contracts, state reliability)
- ✅ Protected data integrity (soft deletes, audit logging, concurrency)
- ✅ Improved UX (loading states, errors, performance)

**Phase 4 focus:** Design abstractions that make it easy to add payments, promotions, and multi-currency WITHOUT refactoring core logic.

---

## Core Principle

> **Extensibility is decided by WHAT YOU FORBID, not what you allow.**

We design the system such that:
- Future providers can be plugged in
- Currency logic stays centralized
- Discount rules don't leak into business logic
- Order creation is decoupled from payment

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                     │
│  - Displays prices (formatted for display only)            │
│  - Shows cart total from backend                           │
│  - Redirects to payment provider UI                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ API Calls
┌──────────────────────▼──────────────────────────────────────┐
│                    BACKEND (NestJS)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CART LAYER                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ CartService: Add item, update, remove               │  │
│  │ Returns: CartResponseDto (computed totals)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                    │
│  DISCOUNT LAYER                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ DiscountEngine: Apply rules, calculate savings      │  │
│  │ Input: Cart items + Discount rules                  │  │
│  │ Output: Applied discounts + new totals              │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                    │
│  ORDER LAYER                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ OrderService: Create immutable order snapshot       │  │
│  │ Input: Cart + Discounts + Currency                  │  │
│  │ Output: Order (locked in time)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                    │
│  PAYMENT LAYER (PLUGGABLE)                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PaymentProvider Interface                           │  │
│  │  ├─ Stripe (embedded checkout)                      │  │
│  │  ├─ Midtrans (redirect + local methods)             │  │
│  │  ├─ PayPal (redirect)                               │  │
│  │  └─ [Future providers]                              │  │
│  │                                                    │  │
│  │ PaymentProviderRegistry (runtime selection)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                    │
│  DATABASE LAYER                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Prisma ORM (PostgreSQL)                             │  │
│  │  - Cart (with TTL for cleanup)                      │  │
│  │  - CartItem                                         │  │
│  │  - Product (with soft delete)                       │  │
│  │  - Order (immutable)                                │  │
│  │  - Payment (tracks payment state)                   │  │
│  │  - AdminAuditLog                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. MONEY VALUE OBJECT

### Design

All monetary amounts are wrapped in `Money` type:

```typescript
interface Money {
  amountCents: number
  currency: CurrencyCode
}

class MoneyValue {
  add(other: Money): MoneyValue     // Fails if currencies mismatch
  subtract(other: Money): MoneyValue
  multiply(scalar: number): MoneyValue
  isGreaterThan(other: Money): boolean
  toJSON(): Money
}
```

### Why This Design

**Problem it solves:**
- No implicit currency conversions
- No floating-point arithmetic errors
- Forces explicit handling at all boundaries

**Example: What breaks PREVENTED**

❌ Before: Price in USD + shipping in EUR = silent NaN
✅ After: Attempting to add USD + EUR throws Error explicitly

### Extension Points

**Multi-currency future:**
When adding JPY (no cents), system already handles it via `MoneyValue.toString()`:
```typescript
const jpy = new MoneyValue(1000, 'JPY')
jpy.toString() // "¥1000" (no decimal)

const usd = new MoneyValue(1999, 'USD')
usd.toString() // "$19.99"
```

**Exchange rate service (future):**
```typescript
const stripe = new PaymentProvider()
const order = createOrder(cartItems, 'JPY')
// Provider handles JPY internally or converts to USD
const payment = await stripe.createPayment(order) // Uses Money type
```

---

## 2. ORDER DOMAIN MODEL

### Design

Order is **immutable snapshot** taken at checkout:

```typescript
interface Order {
  id: string
  items: OrderItem[]                // Locked-in prices
  subtotal: Money
  appliedDiscounts: AppliedDiscount[]
  discountTotal: Money
  taxAmount: Money                  // Placeholder for Phase 5
  shippingCost: Money              // Placeholder for Phase 5
  finalTotal: Money
  createdAt: Date
  userId?: string                  // For order history
}
```

### Why This Design

**Problem it solves:**
- Prices cannot change after checkout
- Discount history is auditable
- Payment happens on immutable data
- No race condition with stock updates

**Flow:**

```
1. User adds items to cart
2. User clicks "Checkout"
3. ApplyDiscounts(cart) → discounts
4. CreateOrder(cart + discounts) → immutable Order
5. CreatePayment(order) → PaymentIntent (from provider)
6. User pays → Webhook → UpdateOrderStatus → FulfillOrder
```

### Validation

Order includes `OrderValidator.validate()` to ensure:
- Items add up to subtotal
- Discounts add up to discount total
- Final total is consistent
- All amounts in same currency

This catches data corruption before payment.

### Extension Points

**Tax (Phase 5):**
```typescript
const order = createOrder(cart, discounts, currency)
// Currently: taxAmount = Money(0)
// Future: TaxService.calculateTax(order) → Money
```

**Shipping (Phase 5):**
```typescript
const order = createOrder(cart, discounts, currency)
// Currently: shippingCost = Money(0)
// Future: ShippingService.calculateCost(order, address) → Money
```

---

## 3. PAYMENT PROVIDER ABSTRACTION

### Design

Every payment provider implements:

```typescript
interface PaymentProvider {
  readonly name: string
  createPayment(order: Order): Promise<PaymentIntent>
  verifyWebhookSignature(payload, signature): Promise<boolean>
  parseWebhookPayload(payload): Promise<PaymentResult>
  refund(paymentId, amount?): Promise<RefundResult>
  getPaymentStatus(paymentId): Promise<PaymentStatus>
}
```

### Why This Design

**Problem it solves:**
- Decouples order from payment processing
- Provider-specific logic isolated
- Easy to add/swap providers
- Webhook handling is provider's responsibility

**Normalized status across ALL providers:**

```typescript
type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled'
```

This means:
- Stripe charge → normalized to `PaymentStatus`
- Midtrans transaction → normalized to `PaymentStatus`
- PayPal order → normalized to `PaymentStatus`

### Implementation Guide

To add a new provider (e.g., Stripe):

1. Create provider class:
   ```typescript
   export class StripePaymentProvider implements PaymentProvider {
     readonly name = 'stripe'
     
     async createPayment(order: Order): Promise<PaymentIntent> {
       // Call Stripe API, return normalized PaymentIntent
     }
     
     async verifyWebhookSignature(payload, sig): Promise<boolean> {
       // Use Stripe's webhook verification
     }
     
     // ... other methods
   }
   ```

2. Register in `PaymentModule`:
   ```typescript
   const stripe = new StripePaymentProvider(process.env.STRIPE_API_KEY)
   registry.register(stripe)
   ```

3. Use in checkout:
   ```typescript
   const provider = registry.getProvider('stripe')
   const payment = await provider.createPayment(order)
   ```

**That's it.** Zero changes to Order, Cart, or Discount logic.

### Extension Points

**New providers:** Add to `PaymentProviderRegistry`
- Stripe, Midtrans, PayPal → Already designed in `payment-providers-template.ts`
- Future: Wise, 2Checkout, Alipay, etc.

**Webhook normalization:** Each provider maps its status to `PaymentStatus`

---

## 4. DISCOUNT & PROMOTION ENGINE

### Design

Discount system is **composable and deterministic**:

```typescript
interface DiscountRule {
  id: string
  code?: string
  type: 'percentage' | 'fixed_amount'
  appliesTo: 'cart_wide' | 'specific_product' | 'category'
  isStackable: boolean
  priority: number
}

class DiscountEngine {
  static applyDiscounts(
    cartItems: CartItem[],
    rules: DiscountRule[],
    currency: CurrencyCode
  ): DiscountApplication[]
}
```

### Why This Design

**Problem it solves:**
- Discounts applied BEFORE payment (not calculated after)
- Results stored (never recalculated)
- Deterministic (same inputs = same output)
- Supports complex rules (stacking, priorities)

### Example Flow

```
Cart:
  - Item A: $10 x 2 = $20
  - Item B: $5 x 1 = $5
  Subtotal: $25

Rules (sorted by priority):
  1. "SUMMER15" - 15% off cart-wide (priority: 100)
  2. "ITEM_B_SPECIAL" - 30% off Item B (priority: 50, stackable)

Calculation:
  1. Apply SUMMER15: 15% of $25 = $3.75 off → $21.25 remaining
  2. Apply ITEM_B_SPECIAL (stackable): 30% of $5 = $1.50 off → $19.75 total

Result: $5.25 off, Final: $19.75
```

### Validation

`DiscountValidator` ensures:
- Percentage 0-100
- Fixed amount non-negative
- Code format valid
- Required fields present

### Extension Points

**Category-based discounts (Phase 5):**
```typescript
const rules = [
  {
    appliesTo: 'category',
    targetCategories: ['electronics'],
    // DiscountEngine will apply to all items in that category
  }
]
```

**Time-limited codes (Black Friday):**
```typescript
const rules = [
  {
    code: 'BLACKFRIDAY2025',
    expiresAt: new Date('2025-11-29'),
    maxUsageCount: 1000,
  }
]
```

**Complex rules (future):**
- Buy 2 get 1 free
- Tiered discounts (spend $50 → 10%, $100 → 20%)
- Free shipping over $X

---

## 5. MULTI-CURRENCY STRATEGY

### Design

**Cart operates in single currency** (chosen at creation):

```typescript
interface Cart {
  // ... existing fields
  currency: CurrencyCode // 'USD' | 'EUR' | 'JPY' | etc.
}
```

**Order currency is immutable:**

```typescript
interface Order {
  currency: CurrencyCode
  // All Money amounts use this currency
}
```

### Why This Design

**Problem it solves:**
- No implicit conversions
- Prevents cross-currency math errors
- Currency mismatch fails loudly

### Rules

1. **No cross-currency operations:**
   ```typescript
   const usd = new MoneyValue(1999, 'USD')
   const eur = new MoneyValue(1999, 'EUR')
   usd.add(eur) // Throws: Cannot add EUR to USD
   ```

2. **All order items must use order's currency:**
   ```typescript
   // Before payment: Validate order.items all use order.currency
   ```

3. **Exchange rates are provider's responsibility:**
   ```typescript
   // If user selects JPY but provider only handles USD:
   // Provider must convert internally (or reject)
   const payment = await stripe.createPayment(order) // order in JPY
   // Stripe SDK handles JPY → USD conversion if needed
   ```

### Extension Points

**Exchange rate service (Phase 5):**
```typescript
interface ExchangeRateService {
  getRate(from: CurrencyCode, to: CurrencyCode): Promise<number>
}

// Use case: Show prices in user's local currency (display only)
// NOT for calculations
```

**Currency selector on cart:**
```
Frontend:
  User selects: [USD ▼]
  Prices update to USD (display)
  Cart.currency = 'USD'
  All calculations in USD
```

---

## 6. CHECKOUT FLOW (COMPLETE EXAMPLE)

### Step-by-Step

```typescript
// 1. USER ADDS ITEMS
const cart = await cartService.addItem(sessionId, productId, quantity)
// Returns: CartResponseDto with totalPriceInCents

// 2. USER VIEWS CART
// Frontend: displays formatPrice(cart.totalPriceInCents)

// 3. USER INITIATES CHECKOUT
const discountRules = await discountService.findApplicableRules()
const appliedDiscounts = DiscountEngine.applyDiscounts(
  cart.items,
  discountRules,
  'USD'
)

// 4. CREATE ORDER (IMMUTABLE SNAPSHOT)
const order = await orderService.create({
  cartId: cart.id,
  discounts: appliedDiscounts,
  currency: 'USD'
})
// order.finalTotal = $19.75 (computed, immutable)

// 5. CREATE PAYMENT INTENT
const provider = paymentRegistry.getProvider('stripe')
const payment = await provider.createPayment(order)
// payment.clientSecret = 'pi_xxxx'
// Frontend: Use stripe.js to process payment

// 6. WEBHOOK FROM PROVIDER
app.post('/webhooks/stripe', async (req) => {
  const isValid = await provider.verifyWebhookSignature(
    req.rawBody,
    req.header('stripe-signature')
  )
  
  if (!isValid) throw new Error('Invalid signature')
  
  const result = await provider.parseWebhookPayload(req.rawBody)
  // result.status = 'paid'
  
  // 7. UPDATE ORDER STATUS
  const order = await orderService.findById(result.orderId)
  await orderService.updatePaymentStatus(order.id, result.status)
  
  // 8. FULFILL ORDER (SEND EMAIL, UPDATE STOCK, etc.)
  await fulfillmentService.process(order)
})
```

---

## 7. CONSTRAINTS & GUARANTEES

### What the System FORBIDS (to stay maintainable)

❌ **No floating-point math for money**
- All monetary values are integers (cents)
- No implicit conversions

❌ **No cross-currency operations without explicit service**
- Add USD + EUR? Must use ExchangeRateService
- System fails loudly if attempted

❌ **No provider modifications to Order**
- Payment provider cannot change order.items or order.finalTotal
- Prevents race conditions and data corruption

❌ **No recalculation of discounts after Order creation**
- Discounts are snapshot records
- Discount logic changes don't affect historical orders

❌ **No mixing order state with payment state**
- Order is about the sale (immutable after creation)
- Payment is about the transaction (mutable status)
- Separate entities

### What the System GUARANTEES

✅ **Every order is valid** before payment
- `OrderValidator.validate()` is called
- All totals are consistent

✅ **Every payment is traceable** to exactly one order
- Order.id ↔ PaymentIntent.orderId (unique)
- Webhooks use PaymentIntent.id to find order

✅ **Prices never change** after order creation
- Order items are locked
- Protects customer and business

✅ **Currency is always explicit**
- No silent conversions
- All operations fail if currency mismatches

✅ **New providers can be added without refactoring core logic**
- Only implement `PaymentProvider` interface
- Register in `PaymentProviderRegistry`
- Done

---

## 8. FUTURE EXTENSIONS (READY TO ADD)

### Phase 5: Shipping & Tax

```typescript
// Currently: placeholder Money(0)
interface Order {
  shippingCost: Money  // Ready to populate
  taxAmount: Money     // Ready to populate
}

// To add shipping:
class ShippingService {
  calculateCost(order: Order, address: Address): Promise<Money>
}

// In checkout:
const shipping = await shippingService.calculateCost(order, userAddress)
const finalOrder = { ...order, shippingCost: shipping }
```

### Phase 6: Subscriptions

```typescript
// Add recurring order type
interface RecurringOrder extends Order {
  frequency: 'daily' | 'weekly' | 'monthly'
  maxOccurrences?: number
  nextBillingDate: Date
}

// Provider handles subscriptions
interface PaymentProvider {
  createSubscription(order: RecurringOrder): Promise<SubscriptionIntent>
}
```

### Phase 7: Loyalty & Rewards

```typescript
// Leverage existing discount system
interface DiscountRule {
  sourceType: 'promo_code' | 'loyalty_points' | 'referral' | 'bulk_discount'
}

// Discount engine handles all sources uniformly
```

---

## 9. TESTING STRATEGY

### Unit Tests (No DB, No External Calls)

```typescript
// Money Value Object
describe('MoneyValue', () => {
  it('should fail on currency mismatch', () => {
    const usd = new MoneyValue(1999, 'USD')
    const eur = new MoneyValue(1999, 'EUR')
    expect(() => usd.add(eur)).toThrow()
  })
})

// Discount Engine
describe('DiscountEngine', () => {
  it('should apply discounts in priority order', () => {
    const cart = [{ product: { priceInCents: 1000 }, quantity: 1 }]
    const rules = [
      { id: '1', type: 'percentage', value: 10, priority: 50 },
      { id: '2', type: 'fixed_amount', value: 50, priority: 100 }
    ]
    const result = DiscountEngine.applyDiscounts(cart, rules, 'USD')
    expect(result).toHaveLength(2)
  })
})

// Order Validator
describe('OrderValidator', () => {
  it('should reject order with mismatched totals', () => {
    const badOrder = {
      items: [...],
      subtotal: Money(1000),
      finalTotal: Money(999), // Wrong!
    }
    expect(() => OrderValidator.validate(badOrder)).toThrow()
  })
})
```

### Integration Tests (With DB)

```typescript
describe('Checkout Flow', () => {
  it('should create immutable order', async () => {
    const cart = await cartService.getCart(sessionId)
    const order = await orderService.create(cart)
    const order2 = await orderService.findById(order.id)
    expect(order2).toEqual(order) // Immutable
  })
})
```

### Provider Mock

```typescript
// For testing checkout without calling real Stripe
class MockPaymentProvider implements PaymentProvider {
  async createPayment(order: Order): Promise<PaymentIntent> {
    return {
      id: 'mock_payment_123',
      orderId: order.id,
      status: 'paid',
      amount: order.finalTotal,
      createdAt: new Date(),
    }
  }
}

registry.register(new MockPaymentProvider())
```

---

## 10. DEPLOYMENT CHECKLIST

- [ ] All Money types use integer cents
- [ ] Order model created in database schema
- [ ] PaymentProvider interface implemented for at least one provider
- [ ] PaymentProviderRegistry functional and tested
- [ ] DiscountEngine applied in checkout flow
- [ ] OrderValidator called before payment
- [ ] Webhook handlers verify signatures
- [ ] Error handling for currency mismatches
- [ ] Documentation for adding new providers

---

## 11. ACCEPTANCE CRITERIA

✅ **Order model is provider-agnostic**
- No Stripe/Midtrans/PayPal specific code in Order

✅ **Payment providers are pluggable**
- Add new provider without changing Order/Cart logic

✅ **Multi-currency rules are explicit**
- Currency mismatches throw errors
- No silent conversions

✅ **Discount engine is composable**
- Rules can be stacked, prioritized, validated
- Results are deterministic

✅ **No refactor needed to add new provider**
- Implement interface, register, done

✅ **No business logic in controllers**
- Services contain logic
- Controllers orchestrate

---

## Summary

This architecture prioritizes **correctness and extensibility over convenience**.

Adding Stripe, Midtrans, or PayPal requires implementing **one interface**.
Adding multi-currency support requires wrapping amounts in **Money type**.
Adding complex discounts only requires new **DiscountRule** definitions.

The system is designed to evolve without breaking existing code.

---

## Webhook Security Enhancements

### Raw Body Validation

Webhook signature verification requires access to the raw (unparsed) HTTP request body.  The server preserves raw bodies for webhook paths by using the Express `json()` middleware `verify` callback in `main.ts`:

```typescript
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.path.includes('/webhooks/')) req.rawBody = buf.toString('utf8')
  },
}))
```

`OrdersController.handleWebhook` will reject requests where neither `rawBody` nor `body` is present, preventing silent signature-verification failures.

### Replay Attack Prevention

Webhook handlers validate the timestamp embedded in Stripe-format signatures (`t=<unix_seconds>,v1=<hash>`).  Requests older than **300 seconds** (5 minutes) are rejected with `acknowledged: false` to prevent replay attacks.

```
Signature: t=1700000000,v1=abc...
```

If the timestamp is absent or uses a non-Stripe format the check is skipped so other providers are unaffected.

### Sensitive Data in Logs

Signature header values are **not** written to the log.  Only their boolean presence (`true`/`false`) is logged to avoid leaking credentials in log aggregators.

---

## Payment Intent Retry Mechanism

`OrderPaymentService.createPayment` wraps the provider's `createPayment` call with an **exponential-backoff retry**:

| Attempt | Delay before next attempt |
|---------|---------------------------|
| 1       | 500 ms                    |
| 2       | 1 000 ms                  |
| 3       | (final — throws)          |

Retries are only attempted for **transient** errors:

- `ECONNRESET` / `ECONNREFUSED` / `ETIMEDOUT` (network)
- `StripeConnectionError` (Stripe SDK)
- HTTP `429 Too Many Requests` (rate limit)
- HTTP `5xx` server errors from the payment provider

Non-transient errors (e.g. invalid API key, bad request) are thrown immediately without retrying.

---

**Status:** ✅ Phase 4 Design Complete  
**Enhancements:** Webhook validation, replay protection, retry mechanism (Phase 5+)
