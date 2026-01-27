# Product-Level Affiliate System

## Overview

This document describes the implementation of a product-level affiliate program for the e-commerce backend. Each affiliate has unique referral links per product, with accurate attribution, auditability, and financial safety.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AFFILIATE MODULE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │ AffiliateService│  │ TrackingService │  │ CommissionService       │ │
│  │                 │  │                 │  │                         │ │
│  │ - Account CRUD  │  │ - Click tracking│  │ - Commission lifecycle  │ │
│  │ - Link mgmt     │  │ - Rate limiting │  │ - Payout batches        │ │
│  │ - Attribution   │  │ - Deduplication │  │ - Statistics            │ │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘ │
│           │                    │                        │               │
│  ┌────────▼────────────────────▼────────────────────────▼────────────┐ │
│  │              AffiliateOrderIntegrationService                     │ │
│  │                                                                   │ │
│  │  • processOrderReferrals() - Order creation                       │ │
│  │  • approveOrderCommissions() - Fulfillment completion             │ │
│  │  • handleFullRefund() / handleItemRefund() - Refund processing    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                │                                       │
└────────────────────────────────┼───────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    AFFILIATE QUEUE      │
                    │                         │
                    │ • track-click           │
                    │ • create-commission     │
                    │ • approve-commission    │
                    │ • cancel-commission     │
                    │ • process-payout        │
                    └─────────────────────────┘
```

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `Affiliate` | Registered affiliate accounts |
| `AffiliateProductLink` | Unique referral links per affiliate per product |
| `AffiliateClick` | Tracks referral link clicks |
| `AffiliateCommission` | Financial record of commissions (immutable) |
| `AffiliatePayoutBatch` | Groups approved commissions for payment |

### Entity Relationship

```
User (1) ──── (0..1) Affiliate
                    │
                    │ (1) ──── (*) AffiliateProductLink
                    │                    │
                    │                    │ (1) ──── (*) AffiliateClick
                    │
                    │ (1) ──── (*) AffiliateCommission
```

## Commission Status Machine

```
                 ┌──────────────────┐
                 │     pending      │
                 └────────┬─────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               │
   ┌──────────┐    ┌──────────┐          │
   │ approved │    │cancelled │◄─────────┤
   └────┬─────┘    └──────────┘          │
        │                                 │
        │         (refund/fraud)          │
        ├─────────────────────────────────┘
        │
        ▼
   ┌──────────┐
   │   paid   │
   └──────────┘
```

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/affiliate/track` | Track referral click |

### Authenticated (Affiliate)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/affiliate/profile` | Get own affiliate profile |
| GET | `/api/affiliate/links` | Get own referral links |
| POST | `/api/affiliate/links` | Create referral link |
| DELETE | `/api/affiliate/links/:id` | Deactivate link |
| GET | `/api/affiliate/stats` | Get earnings statistics |
| GET | `/api/affiliate/commissions` | Get commission history |
| GET | `/api/affiliate/payouts` | Get payout history |
| GET | `/api/affiliate/clicks` | Get click history |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/affiliate/affiliates` | List all affiliates |
| GET | `/api/admin/affiliate/affiliates/:id` | Get affiliate details |
| POST | `/api/admin/affiliate/affiliates` | Create affiliate account |
| PATCH | `/api/admin/affiliate/affiliates/:id` | Update affiliate |
| POST | `/api/admin/affiliate/affiliates/:id/suspend` | Suspend affiliate |
| GET | `/api/admin/affiliate/commissions` | List all commissions |
| POST | `/api/admin/affiliate/payout` | Create payout batch |
| POST | `/api/admin/affiliate/payout/:batchId/mark-paid` | Mark payout as paid |
| POST | `/api/admin/affiliate/payout/:batchId/mark-failed` | Mark payout as failed |
| GET | `/api/admin/affiliate/stats` | Get program stats |

## Referral Link Format

```
https://example.com/product/{slug}?ref={referral_code}
```

## Order Integration

### At Order Creation

```typescript
// In your order creation logic (e.g., CreateOrderUseCase)
import { AffiliateOrderIntegrationService } from '../affiliate/integration';

// After order items are saved
const referrals = new Map<number, string>();
// Populate from checkout session (e.g., cookies, localStorage)
referrals.set(productId1, 'abc123');
referrals.set(productId2, 'xyz789');

const commissions = await affiliateOrderIntegration.processOrderReferrals(
  order.id,
  buyerUserId,
  orderItems,
  referrals,
  order.currency,
);

console.log(`Created ${commissions.length} affiliate commissions`);
```

### On Fulfillment Completion

```typescript
// In your fulfillment service, when order is delivered
import { AffiliateOrderIntegrationService } from '../affiliate/integration';

// When fulfillmentStatus → 'delivered'
await affiliateOrderIntegration.approveOrderCommissions(orderId);
```

### On Refund

```typescript
// Full refund
await affiliateOrderIntegration.handleFullRefund(
  orderId,
  refundId,
  'customer_requested',
);

// Partial refund (specific item)
await affiliateOrderIntegration.handleItemRefund(
  orderId,
  orderItemId,
  refundId,
  'partial_refund',
);
```

## Commission Calculation

```
commission_amount = order_item_subtotal × commission_rate

Where:
- order_item_subtotal = unit_price × quantity (at purchase time)
- commission_rate = link.commissionRate ?? affiliate.defaultCommissionRate
```

## Idempotency

All commission creation is idempotent:

```
idempotencyKey = `${orderId}:${orderItemId}:${affiliateId}`
```

This ensures:
- Order retries don't create duplicate commissions
- Payment retries are safe
- Queue job retries work correctly

## Anti-Abuse Measures

1. **Self-Purchase Block**: Affiliates cannot earn on their own orders
2. **Click Deduplication**: One click per session per link
3. **Rate Limiting**: 30 clicks/minute per IP
4. **Commission Freeze**: Suspended affiliates can't earn
5. **Immutable Records**: Commission amounts never change after creation

## Queue Jobs

| Job | Trigger | Priority | Retries |
|-----|---------|----------|---------|
| `track-click` | Public click tracking | Low (10) | 2 |
| `create-commission` | Order creation | High (1) | 5 |
| `approve-commission` | Fulfillment | Medium (3) | 3 |
| `cancel-commission` | Refund | High (1) | 5 |
| `process-payout` | Admin action | Medium (5) | 3 |

## Example: Complete Order → Commission Flow

```
1. Customer visits: /product/awesome-widget?ref=abc123
   └─> Click tracked (deduped by session)

2. Customer adds to cart
   └─> Referral stored in checkout session

3. Customer completes checkout
   └─> Order created
   └─> processOrderReferrals() called
   └─> Commission created (status: pending)

4. Payment succeeds
   └─> Order status → PAID

5. Order shipped & delivered
   └─> Fulfillment status → delivered
   └─> approveOrderCommissions() called
   └─> Commission status → approved

6. Admin processes payout
   └─> createPayoutBatch() called
   └─> Batch created (status: pending)
   └─> External payment sent (PayPal, etc.)
   └─> markPayoutAsPaid() called
   └─> Commission status → paid
```

## Edge Cases

### Refund After Approval

If a commission is approved but then the order is refunded:

```typescript
// Commission can still be cancelled
await handleFullRefund(orderId, refundId, 'refund_after_approval');
// Commission status: approved → cancelled
```

### Partial Refund

Only commissions for the refunded items are cancelled:

```typescript
await handleItemRefund(orderId, orderItemId, refundId, 'partial_refund');
// Only that item's commission is cancelled
```

### Affiliate Suspended Mid-Order

If an affiliate is suspended after order creation but before fulfillment:
- Existing pending commissions remain
- They can be manually cancelled by admin
- New orders won't create commissions

### Payment Provider Integration

The payout system is designed to integrate with:
- PayPal Payouts API
- Stripe Connect
- Bank transfers (manual)

Currently uses simulated payments. Production integration example:

```typescript
// In affiliate-queue.processor.ts, handleProcessPayout
const paypalClient = new PayPalClient();
const result = await paypalClient.createPayout({
  recipient: affiliatePayoutEmail,
  amount: totalAmountCents / 100,
  currency,
});
const paymentReference = result.payoutBatchId;
```

## Observability

### Structured Logging

All operations produce structured logs:

```json
{
  "level": "log",
  "context": "AffiliateCommissionService",
  "message": "Commission created: 500 cents for order ord_123 item itm_456",
  "affiliateId": "aff_789",
  "orderId": "ord_123",
  "amountCents": 500
}
```

### Metrics Ready

The system exposes data suitable for:
- Commission funnel (pending → approved → paid)
- Conversion rates (clicks → commissions)
- Top affiliates by revenue
- Payout volume by period

## Security Considerations

1. **Commission rates** are locked at purchase time (not changeable after)
2. **Base amounts** are taken from order item subtotals (immutable)
3. **Payout details** should be encrypted in production
4. **Admin actions** are logged with `initiatedBy` user ID
5. **Referral codes** are cryptographically random (not guessable)

## Migration Notes

To apply the schema changes:

```bash
# Generate migration
npx prisma migrate dev --name add_affiliate_system

# Or in production
npx prisma migrate deploy
```

## Testing Checklist

- [x] Create affiliate account
- [x] Create product links
- [x] Track clicks (with deduplication)
- [x] Complete order with referral
- [x] Verify commission created
- [x] Fulfill order → commission approved
- [x] Process refund → commission cancelled
- [x] Create payout batch
- [x] Mark payout as paid
- [x] Verify self-purchase blocked
- [x] Verify suspended affiliate blocked
