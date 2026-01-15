# Backend Architecture - Current State Analysis

**Date**: January 15, 2026  
**Status**: 🔴 Critical - Requires Immediate Stabilization  
**Analyst**: Principal Architect  

---

## Executive Summary

The backend has accumulated **significant architectural debt** through organic growth and feature additions without consistent architectural governance. While the system is functional, it exhibits multiple anti-patterns that threaten maintainability, testability, and future scalability.

**Critical Issues**:
- ❌ **Circular dependencies** between core modules
- ❌ **Layer violations** (controllers directly accessing Prisma)
- ❌ **Inconsistent module boundaries** (admin logic scattered)
- ❌ **No feature stability classification**
- ❌ **Documentation scattered** across root folder

**Opportunities**:
- ✅ No `forwardRef()` usage detected
- ✅ Queue infrastructure already in place
- ✅ Core domain logic exists (needs extraction)
- ✅ Payment provider abstraction established

---

## 1. Module Structure Analysis

### 1.1 Current Module Inventory

```
backend/src/
├── admin/              ⚠️  Mixed concerns (orders, webhooks, tax, shipping, inventory)
├── analytics/          ✅  Self-contained
├── audit/              ✅  Self-contained utility
├── auth/               ✅  Self-contained
├── cart/               ✅  Clean boundaries
├── common/             ✅  Shared types & utilities
├── email/              ✅  Infrastructure service
├── fulfillment/        ⚠️  Domain logic + queue coupling
├── orders/             ❌  Depends on admin (circular)
├── payments/           ⚠️  Providers only, missing abstraction layer
├── prisma/             ✅  Infrastructure
├── products/           ✅  Clean module
├── queues/             ⚠️  Queue implementations tightly coupled
├── services/           ❌  "Phase6Module" - poor naming, unclear purpose
├── shipping/           ⚠️  Controller only (service in /services)
└── tax/                ⚠️  Controller only (service in /services)
```

### 1.2 Module Dependency Graph

```
┌─────────────┐
│  AppModule  │
└──────┬──────┘
       │
       ├──> ProductsModule ✅
       ├──> CartModule ✅
       ├──> AuthModule ✅
       ├──> PrismaModule ✅
       ├──> Phase6Module ❌ (unclear naming)
       ├──> ShippingController ❌ (should be in module)
       ├──> TaxController ❌ (should be in module)
       │
       ├──> OrdersModule
       │    ├──> CartModule
       │    ├──> ProductsModule
       │    ├──> PaymentsModule
       │    ├──> EmailModule
       │    ├──> Phase6Module
       │    └──> AdminModule ❌ CIRCULAR DEPENDENCY
       │         └──> OrdersModule ❌ CIRCULAR
       │
       ├──> AdminModule
       │    ├──> ProductsModule
       │    ├──> AuthModule
       │    ├──> PaymentsModule
       │    ├──> OrdersModule ❌ CIRCULAR DEPENDENCY
       │    └──> FulfillmentModule
       │
       ├──> FulfillmentModule
       │    ├──> PrismaModule
       │    └──> QueueModule
       │
       ├──> AnalyticsModule
       │    └──> PrismaModule
       │
       └──> QueueModule
            ├──> EmailQueueModule
            ├──> WebhookQueueModule
            ├──> AnalyticsQueueModule
            └──> OrderQueueModule
```

---

## 2. Critical Architectural Violations

### 2.1 Circular Dependency: Orders ↔ Admin

**Problem**:
```typescript
// orders/orders.module.ts
import { AdminOrdersController } from '../admin/admin-orders.controller'
import { AdminOrdersService } from '../admin/admin-orders.service'

// admin/admin.module.ts
import { OrdersModule } from '../orders/orders.module'

// admin/admin-orders.service.ts
import { OrderPaymentService } from '../orders/payment.service'
```

**Risk Level**: 🔴 **Critical**

**Impact**:
- Module initialization order issues
- Cannot extract modules to microservices
- Testing requires loading both modules
- Unclear ownership of admin order logic

**Root Cause**:
- Admin controllers/services placed in `/admin` folder
- But logic depends on `/orders` domain services
- `/orders` module re-exports admin controllers

---

### 2.2 Layer Violation: Controllers → Infrastructure

**Problem**: Multiple controllers directly inject `PrismaService`

**Violators**:
- `admin/tax-rules.controller.ts` ❌
- `admin/shipping-methods.controller.ts` ❌
- `admin/reservations.controller.ts` ❌
- `analytics/analytics.controller.ts` ❌
- `orders/orders.controller.ts` ❌

**Example**:
```typescript
// admin/tax-rules.controller.ts
@Controller('api/admin/tax-rules')
export class TaxRulesController {
  constructor(private prisma: PrismaService) {} // ❌ Direct DB access

  @Get()
  async getAllTaxRules() {
    const [taxRules, total] = await Promise.all([
      this.prisma.taxRule.findMany({ ... }), // ❌ Query logic in controller
      this.prisma.taxRule.count(),
    ])
    return { data: taxRules, meta: { ... } }
  }
}
```

**Risk Level**: 🔴 **High**

**Impact**:
- Untestable without database
- Business logic leaks into presentation layer
- Cannot swap ORM/database
- Violates single responsibility principle

**Correct Pattern**:
```typescript
@Controller('api/admin/tax-rules')
export class TaxRulesController {
  constructor(private taxRulesAdminService: TaxRulesAdminService) {} // ✅

  @Get()
  async getAllTaxRules() {
    return this.taxRulesAdminService.findAll(params) // ✅ Delegate to service
  }
}
```

---

### 2.3 Scattered Module Structure

**Problem**: Tax & Shipping logic split across folders

```
src/
├── services/
│   ├── tax/
│   │   └── tax.service.ts        # Business logic
│   ├── shipping/
│   │   └── shipping.service.ts   # Business logic
│   └── phase6.module.ts          # ❌ Poor naming
├── tax/
│   └── tax.controller.ts         # Public API
└── shipping/
    └── shipping.controller.ts    # Public API
```

**Risk Level**: 🟡 **Medium**

**Impact**:
- Hard to find related code
- "Phase6Module" is meaningless to new developers
- Unclear what's experimental vs stable

**Expected Structure**:
```
src/
├── tax/
│   ├── tax.module.ts
│   ├── tax.service.ts
│   ├── tax.controller.ts
│   └── admin/
│       └── tax-admin.controller.ts
└── shipping/
    ├── shipping.module.ts
    ├── shipping.service.ts
    ├── shipping.controller.ts
    └── admin/
        └── shipping-admin.controller.ts
```

---

### 2.4 Admin Module as "God Module"

**Problem**: Admin module contains unrelated controllers

```typescript
@Module({
  imports: [ProductsModule, AuthModule, PaymentsModule, OrdersModule, FulfillmentModule],
  controllers: [
    AdminController,              // Generic admin
    WebhookAdminController,       // Payments domain
    AdminOrdersController,        // Orders domain
    TaxRulesController,           // Tax domain
    ShippingMethodsController,    // Shipping domain
    ReservationsController,       // Inventory domain
  ],
  providers: [AdminOrdersService],
})
export class AdminModule {}
```

**Risk Level**: 🟡 **Medium-High**

**Impact**:
- Violates single responsibility
- Admin module depends on 5 other modules
- No clear domain boundaries
- Hard to find admin logic for specific features

**Correct Pattern**: Each domain module owns its admin controllers

---

## 3. Positive Architectural Patterns

### 3.1 Payment Provider Abstraction ✅

**Good**:
```typescript
// common/types/payment.ts
export interface PaymentProvider {
  name: string
  createPaymentIntent(params: PaymentIntent): Promise<PaymentResult>
  handleWebhook(payload: any, signature: string): Promise<WebhookResult>
}

// payments/stripe.provider.ts
export class StripePaymentProvider implements PaymentProvider { ... }

// payments/midtrans.provider.ts
export class MidtransPaymentProvider implements PaymentProvider { ... }
```

**Strengths**:
- Clean abstraction
- Easy to add new providers
- Testable with mocks
- Registry pattern for provider lookup

---

### 3.2 Queue Infrastructure ✅

**Good**:
```
queues/
├── queue.module.ts               # Aggregator module
├── email-queue/
│   ├── email-queue.module.ts
│   ├── email-queue.service.ts
│   └── email-queue.processor.ts
├── webhook-queue/
├── analytics-queue/
└── order-queue/
```

**Strengths**:
- Async processing ready
- Separate concerns (publisher/processor)
- Retry logic built-in
- Monitoring endpoint exists

---

### 3.3 Audit Logging ✅

**Good**:
```typescript
@Injectable()
export class AuditLogService {
  async logAction(data: AdminAuditLogInput): Promise<void> {
    await this.prisma.adminAuditLog.create({ data })
  }
}
```

**Strengths**:
- Immutable audit trail
- Centralized service
- Used consistently in admin actions

---

## 4. Missing Architectural Components

### 4.1 No Feature Flags ❌

**Problem**: No mechanism to gate experimental features

**Impact**:
- Can't safely deploy partial features
- All-or-nothing releases
- Hard to A/B test
- Can't roll back quickly

**Required**:
```typescript
@Injectable()
export class FeatureFlagService {
  isEnabled(flag: string): boolean
  isEnabledForUser(flag: string, userId: string): boolean
}

// Usage in service
if (this.featureFlags.isEnabled('inventory_reservation_v2')) {
  return this.reserveInventoryV2(...)
}
return this.reserveInventoryV1(...)
```

---

### 4.2 No Domain Layer Separation ❌

**Problem**: Services mix domain logic with infrastructure

**Current**:
```typescript
@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,        // Infrastructure
    private cartService: CartService,     // Domain
    private taxService: TaxService,       // Domain
    private shippingService: ShippingService, // Domain
  ) {}

  async createOrder(dto: CreateOrderDto) {
    // Mixed domain + infrastructure logic
    const cart = await this.prisma.cart.findUnique({ ... }) // Infrastructure
    const tax = await this.taxService.calculateTax(...)     // Domain
    // ...
  }
}
```

**Expected** (Clean Architecture):
```
orders/
├── domain/
│   ├── order.entity.ts
│   ├── order-item.entity.ts
│   └── order.repository.interface.ts
├── application/
│   ├── create-order.usecase.ts
│   └── process-payment.usecase.ts
└── infrastructure/
    ├── order.repository.prisma.ts
    └── order.mapper.ts
```

---

### 4.3 No Centralized Error Handling ❌

**Problem**: Error handling inconsistent across controllers

**Examples**:
```typescript
// Some throw Error
throw new Error('Tax rule not found')

// Some throw BadRequestException
throw new BadRequestException('Invalid order status')

// Some return null
if (!order) return null
```

**Required**: Standardized exception filters + domain exceptions

---

## 5. Technical Debt Inventory

| Issue | Severity | Module | Effort |
|-------|----------|--------|--------|
| Orders ↔ Admin circular dependency | 🔴 Critical | orders, admin | High |
| Controllers inject PrismaService | 🔴 High | admin, analytics, orders | Medium |
| Phase6Module poor naming | 🟡 Medium | services | Low |
| Scattered tax/shipping structure | 🟡 Medium | tax, shipping, services | Medium |
| Admin "god module" | 🟡 Medium | admin | Medium |
| No feature flags | 🟡 Medium | N/A | Medium |
| No domain layer | 🟡 Medium | All | High |
| Inconsistent error handling | 🟢 Low | All | Low |

---

## 6. Dependency Flow Violations

### Current (Incorrect) Flow:
```
Controller → Service → PrismaService ❌
Controller → PrismaService ❌
```

### Target (Clean Architecture) Flow:
```
Controller → UseCase → Domain Service → Repository Interface
                                              ↓
                                    Repository Implementation → Prisma
```

---

## 7. Recommendations Priority Matrix

### Phase 0: Immediate Stabilization (Week 1-2)

1. **Break Orders ↔ Admin circular dependency** 🔴
   - Move `AdminOrdersController` to `/orders/admin/`
   - Move `AdminOrdersService` to `/orders/admin/`
   - Remove admin exports from `OrdersModule`

2. **Extract controllers from Prisma** 🔴
   - Create admin service layer for tax-rules, shipping-methods, reservations
   - Update controllers to inject services instead of Prisma

3. **Rename Phase6Module → ShippingTaxInventoryModule** 🟡
   - Clear intent
   - Better discovery

### Phase 1: Structural Cleanup (Week 3-4)

4. **Consolidate tax module**
   - Merge `/services/tax/` into `/tax/`
   - Create `/tax/admin/` subfolder

5. **Consolidate shipping module**
   - Merge `/services/shipping/` into `/shipping/`
   - Create `/shipping/admin/` subfolder

6. **Break apart admin module**
   - Move domain-specific admin controllers to their modules
   - Keep only generic admin controller

### Phase 2: Feature Flags (Week 5)

7. **Implement centralized feature flag service**
   - Create `@ecomm/feature-flags` module
   - Integrate with config service
   - Gate experimental features

### Phase 3: Domain Layer Introduction (Week 6-8)

8. **Extract domain entities**
   - Order domain
   - Payment domain
   - Inventory domain

9. **Introduce repository pattern**
   - Define repository interfaces
   - Implement Prisma repositories

---

## 8. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Circular dependencies | 1 | 0 |
| Controllers injecting Prisma | 5 | 0 |
| Modules with single responsibility | 60% | 90% |
| Test coverage (unit) | Unknown | 70% |
| Module coupling score | High | Low |
| Documentation completeness | 20% | 90% |

---

## 9. What NOT to Touch (Yet)

**Stable Modules** (leave as-is during stabilization):
- ✅ `auth/` - Working, clean boundaries
- ✅ `cart/` - Simple, self-contained
- ✅ `products/` - Clean module
- ✅ `email/` - Infrastructure service, working
- ✅ `prisma/` - Database client wrapper

**Queue System** (refine later, not critical path):
- ⚠️ Queue modules work but could be better organized
- Not blocking other refactors

---

## 10. Next Steps

1. **Create Target Architecture Document** → `architecture/TARGET_ARCHITECTURE.md`
2. **Define Migration Plan** → `architecture/MIGRATION_PLAN.md`
3. **Implement Feature Flag Service** → Immediate safety net
4. **Break Circular Dependencies** → Unblock modularity
5. **Extract Service Layer** → Remove controller → Prisma coupling

---

## Appendix A: File Inventory

**Controllers** (15 total):
- Public API: 8 files
- Admin API: 7 files

**Services** (20+ total):
- Domain services: 12
- Infrastructure services: 4
- Queue services: 4

**Modules** (17 total):
- Feature modules: 10
- Queue modules: 4
- Infrastructure modules: 3

---

**Status**: Analysis Complete ✅  
**Next Document**: `TARGET_ARCHITECTURE.md`
