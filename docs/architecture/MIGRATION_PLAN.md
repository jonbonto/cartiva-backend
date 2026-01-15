# Migration Plan - Backend Architecture Recovery

**Date**: January 15, 2026  
**Status**: 🎯 Execution Ready  
**Duration**: 8 weeks  
**Risk Level**: Medium (mitigated by feature flags)  

---

## Executive Summary

This plan details **step-by-step migration** from current chaotic state to clean, maintainable architecture. Each phase is **independently deployable** with **zero downtime**.

###Strategy: **Strangler Fig Pattern** + **Feature Flags**

- ✅ Build new alongside old
- ✅ Route traffic gradually
- ✅ Delete old when safe
- ✅ No big-bang rewrites

---

## Phase 0: Foundation (Week 1) 🔴 CRITICAL

**Goal**: Establish safety nets before refactoring

### Task 0.1: Implement Feature Flag System

**Priority**: P0 (Blocking all other work)

**Steps**:
1. Create `src/feature-flags/` module
2. Implement `FeatureFlagsService`
3. Add to `AppModule` as global module
4. Define initial flags:
   - `orders_clean_architecture`
   - `tax_service_layer`
   - `shipping_service_layer`
   - `inventory_reservation_v2`

**Files to Create**:
```
src/feature-flags/
├── feature-flags.module.ts
├── feature-flags.service.ts
├── decorators/
│   └── feature-flag.decorator.ts
└── guards/
    └── feature-flag.guard.ts
```

**Acceptance Criteria**:
- [ ] Service can read flags from environment
- [ ] `isEnabled()` method works
- [ ] Admin endpoint shows all flags
- [ ] Unit tests pass

**Estimate**: 1 day

---

### Task 0.2: Add ESLint Architecture Rules

**Priority**: P0

**Steps**:
1. Install `@typescript-eslint/parser`
2. Add custom rules:
   ```json
   {
     "rules": {
       "no-restricted-imports": ["error", {
         "patterns": [{
           "group": ["**/infrastructure/**"],
           "message": "Controllers cannot import infrastructure directly"
         }]
       }]
     }
   }
   ```

**Acceptance Criteria**:
- [ ] ESLint catches controller → Prisma violations
- [ ] CI fails on architecture violations

**Estimate**: 0.5 days

---

### Task 0.3: Document Current State

**Priority**: P1

**Steps**:
1. ✅ Create `/docs/architecture/CURRENT_STATE_ANALYSIS.md` (DONE)
2. ✅ Create `/docs/architecture/TARGET_ARCHITECTURE.md` (DONE)
3. ✅ Create `/docs/architecture/FEATURE_FLAGS.md` (DONE)
4. Create `/docs/README.md` (index of all docs)

**Acceptance Criteria**:
- [ ] Developers can understand current architecture in 15 minutes
- [ ] Target state is clear
- [ ] Migration path documented

**Estimate**: 1 day

---

**Week 1 Deliverable**: ✅ Feature flags ready, documentation complete

---

## Phase 1: Break Circular Dependencies (Week 2) 🔴 CRITICAL

**Goal**: Eliminate Orders ↔ Admin circular dependency

### Task 1.1: Extract AdminOrdersModule

**Problem**: `AdminOrdersController` and `AdminOrdersService` are in `/admin` but depend on `/orders`

**Solution**: Move admin logic into orders module

**Steps**:
1. Create `src/orders/admin/` folder
2. Move `AdminOrdersController` → `src/orders/admin/admin-orders.controller.ts`
3. Move `AdminOrdersService` → `src/orders/admin/admin-orders.service.ts`
4. Update imports in `OrdersModule`
5. Remove from `AdminModule`

**Before**:
```
src/
├── admin/
│   ├── admin-orders.controller.ts  ← Move
│   └── admin-orders.service.ts     ← Move
└── orders/
    └── orders.module.ts
```

**After**:
```
src/
└── orders/
    ├── admin/
    │   ├── admin-orders.controller.ts  ← Moved
    │   └── admin-orders.service.ts     ← Moved
    └── orders.module.ts
```

**Files to Change**:
- `src/orders/orders.module.ts` - Add admin controllers
- `src/admin/admin.module.ts` - Remove OrdersModule import

**Acceptance Criteria**:
- [ ] `npm run build` passes
- [ ] No circular dependency warnings
- [ ] Admin orders endpoints still work
- [ ] Tests pass

**Estimate**: 1 day

---

### Task 1.2: Verify Dependency Graph

**Steps**:
1. Run `npx madge --circular src/`
2. Verify zero circular dependencies
3. Generate dependency graph: `npx madge --image graph.png src/`

**Acceptance Criteria**:
- [ ] Zero circular dependencies
- [ ] Dependency graph shows clean flow

**Estimate**: 0.5 days

---

**Week 2 Deliverable**: ✅ No circular dependencies

---

## Phase 2: Extract Service Layer from Controllers (Week 3-4) 🔴 HIGH

**Goal**: Controllers delegate to services, not Prisma

### Task 2.1: Create TaxRulesAdminService

**Current Violation**:
```typescript
// admin/tax-rules.controller.ts
constructor(private prisma: PrismaService) {} // ❌
```

**Solution**: Create service layer

**Steps**:
1. Create `src/tax/admin/tax-rules-admin.service.ts`
2. Move all Prisma queries from controller to service
3. Update controller to inject service
4. Wrap with feature flag `tax_service_layer`

**New File**:
```typescript
// src/tax/admin/tax-rules-admin.service.ts
@Injectable()
export class TaxRulesAdminService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: PaginationParams) {
    const [taxRules, total] = await Promise.all([
      this.prisma.taxRule.findMany({ ... }),
      this.prisma.taxRule.count(),
    ])
    return { data: taxRules, meta: { ... } }
  }

  async create(dto: CreateTaxRuleDto) {
    return this.prisma.taxRule.create({ data: dto })
  }

  async update(id: string, dto: UpdateTaxRuleDto) {
    return this.prisma.taxRule.update({ where: { id }, data: dto })
  }

  async delete(id: string) {
    return this.prisma.taxRule.delete({ where: { id } })
  }
}
```

**Updated Controller**:
```typescript
// admin/tax-rules.controller.ts
@Controller('api/admin/tax-rules')
export class TaxRulesController {
  constructor(
    private taxRulesAdmin: TaxRulesAdminService, // ✅ Service layer
    private featureFlags: FeatureFlagsService
  ) {}

  @Get()
  async getAllTaxRules(@Query() params) {
    if (this.featureFlags.isEnabled('tax_service_layer')) {
      return this.taxRulesAdmin.findAll(params) // ✅ New
    }
    
    // ⚠️ Old (fallback) - delete after migration
    const [taxRules, total] = await Promise.all([
      this.prisma.taxRule.findMany({ ... }),
      this.prisma.taxRule.count(),
    ])
    return { data: taxRules, meta: { ... } }
  }
}
```

**Acceptance Criteria**:
- [ ] Service created and tested
- [ ] Controller uses service when flag enabled
- [ ] Old code works when flag disabled
- [ ] Unit tests for service
- [ ] E2E tests pass with flag ON and OFF

**Estimate**: 1.5 days

---

### Task 2.2: Create ShippingMethodsAdminService

**Same pattern as Task 2.1**

**Steps**:
1. Create `src/shipping/admin/shipping-methods-admin.service.ts`
2. Extract Prisma logic from controller
3. Wrap with feature flag `shipping_service_layer`

**Estimate**: 1.5 days

---

### Task 2.3: Create InventoryReservationsAdminService

**Same pattern as Task 2.1**

**Steps**:
1. Create `src/services/inventory/inventory-reservations-admin.service.ts`
2. Extract Prisma logic from controller
3. Wrap with feature flag (reuse `inventory_reservation_v2`)

**Estimate**: 1.5 days

---

### Task 2.4: Extract Analytics Service

**Current**: `AnalyticsController` directly uses Prisma

**Steps**:
1. Create `src/analytics/analytics.service.ts`
2. Move queries from controller
3. No feature flag needed (simple extraction)

**Estimate**: 1 day

---

**Week 3-4 Deliverable**: ✅ All controllers use services, no direct Prisma access

---

## Phase 3: Consolidate Module Structure (Week 5) 🟡 MEDIUM

**Goal**: Tax and Shipping modules have consistent structure

### Task 3.1: Consolidate Tax Module

**Current**:
```
src/
├── services/tax/tax.service.ts
└── tax/tax.controller.ts
```

**Target**:
```
src/tax/
├── tax.module.ts
├── domain/
│   └── tax.service.ts           ← From services/tax/
├── admin/
│   ├── tax-rules.controller.ts  ← From admin/
│   └── tax-rules-admin.service.ts
└── tax.controller.ts             ← Public API
```

**Steps**:
1. Create `src/tax/domain/` folder
2. Move `services/tax/tax.service.ts` → `tax/domain/tax.service.ts`
3. Create `src/tax/tax.module.ts`
4. Update imports across codebase
5. Move admin controllers into `tax/admin/`
6. Delete empty `services/tax/` folder

**Acceptance Criteria**:
- [ ] All tax-related code in one module
- [ ] Clear separation: domain/ vs admin/ vs public API
- [ ] Tests pass
- [ ] No broken imports

**Estimate**: 2 days

---

### Task 3.2: Consolidate Shipping Module

**Same pattern as Task 3.1**

**Target**:
```
src/shipping/
├── shipping.module.ts
├── domain/
│   └── shipping.service.ts
├── admin/
│   ├── shipping-methods.controller.ts
│   └── shipping-methods-admin.service.ts
└── shipping.controller.ts
```

**Estimate**: 2 days

---

### Task 3.3: Rename Phase6Module → DomainServicesModule

**Current**: `Phase6Module` is unclear

**Target**: `DomainServicesModule` or split into modules

**Option A** (Quick): Rename only
```typescript
@Module({
  imports: [PrismaModule],
  providers: [TaxService, ShippingService, InventoryReservationService],
  exports: [TaxService, ShippingService, InventoryReservationService],
})
export class DomainServicesModule {} // ✅ Better name
```

**Option B** (Better): Delete and import from domain modules
```typescript
// Delete Phase6Module
// Tax/Shipping modules already export their services
```

**Recommendation**: Option B (wait until Task 3.1/3.2 complete)

**Estimate**: 0.5 days

---

**Week 5 Deliverable**: ✅ Consistent module structure, no "Phase6" naming

---

## Phase 4: Introduce Domain Layer (Week 6-7) 🟡 MEDIUM

**Goal**: Separate domain logic from infrastructure

**Note**: This is the most complex phase. Start with Orders module only.

### Task 4.1: Extract Order Domain Entity

**Create**: `src/orders/domain/order.entity.ts`

```typescript
export class Order {
  private constructor(
    readonly id: string,
    private items: OrderItem[],
    private status: OrderStatus,
    private subtotal: Money,
    private tax: Money,
    private shipping: Money
  ) {}

  static create(params: CreateOrderParams): Order {
    // Domain validation
    if (params.items.length === 0) {
      throw new OrderDomainException('Order must have items')
    }

    return new Order(
      generateId(),
      params.items,
      OrderStatus.PENDING,
      calculateSubtotal(params.items),
      Money.zero(),
      Money.zero()
    )
  }

  applyTax(tax: Money): void {
    if (tax.isNegative()) {
      throw new OrderDomainException('Tax cannot be negative')
    }
    this.tax = tax
  }

  calculateTotal(): Money {
    return this.subtotal.add(this.tax).add(this.shipping)
  }

  canBeCancelled(): boolean {
    return this.status === OrderStatus.PENDING ||
           this.status === OrderStatus.PAYMENT_FAILED
  }

  cancel(): void {
    if (!this.canBeCancelled()) {
      throw new OrderDomainException(
        `Cannot cancel order in ${this.status} status`
      )
    }
    this.status = OrderStatus.CANCELLED
  }
}
```

**Estimate**: 2 days

---

### Task 4.2: Create Repository Interface

**Create**: `src/orders/domain/order.repository.ts`

```typescript
export interface OrderRepository {
  save(order: Order): Promise<void>
  findById(id: string): Promise<Order | null>
  findByUserId(userId: string): Promise<Order[]>
}
```

**Estimate**: 0.5 days

---

### Task 4.3: Implement Prisma Repository

**Create**: `src/orders/infrastructure/order.repository.prisma.ts`

```typescript
@Injectable()
export class OrderRepositoryPrisma implements OrderRepository {
  constructor(private prisma: PrismaService) {}

  async save(order: Order): Promise<void> {
    const dbModel = OrderMapper.toPrisma(order)
    await this.prisma.order.upsert({
      where: { id: dbModel.id },
      update: dbModel,
      create: dbModel
    })
  }

  async findById(id: string): Promise<Order | null> {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!dbOrder) return null
    return OrderMapper.toDomain(dbOrder)
  }
}
```

**Estimate**: 1.5 days

---

### Task 4.4: Create Mapper

**Create**: `src/orders/infrastructure/order.mapper.ts`

```typescript
export class OrderMapper {
  static toDomain(dbOrder: PrismaOrder): Order {
    // Map DB model → Domain entity
  }

  static toPrisma(order: Order): PrismaOrderCreateInput {
    // Map Domain entity → DB model
  }
}
```

**Estimate**: 1 day

---

### Task 4.5: Create CreateOrderUseCase

**Create**: `src/orders/application/create-order.usecase.ts`

```typescript
@Injectable()
export class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private taxService: TaxService,
    private shippingService: ShippingService
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    // 1. Create domain entity
    const order = Order.create({
      items: command.items,
      userId: command.userId
    })

    // 2. Calculate tax
    const tax = await this.taxService.calculate(
      command.address,
      order.subtotal
    )
    order.applyTax(tax)

    // 3. Calculate shipping
    const shipping = await this.shippingService.calculate(
      command.address,
      command.shippingMethodId
    )
    order.applyShipping(shipping)

    // 4. Persist
    await this.orderRepository.save(order)

    return order
  }
}
```

**Estimate**: 2 days

---

### Task 4.6: Update Controller to Use UseCase

**Update**: `src/orders/orders.controller.ts`

```typescript
@Controller('api/orders')
export class OrdersController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase,
    private ordersService: OrdersService, // Legacy
    private featureFlags: FeatureFlagsService
  ) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    if (this.featureFlags.isEnabled('orders_clean_architecture')) {
      return this.createOrderUseCase.execute(dto) // ✅ New
    }
    
    return this.ordersService.createOrder(dto) // ⚠️ Old
  }
}
```

**Estimate**: 1 day

---

**Week 6-7 Deliverable**: ✅ Orders module has domain layer (behind feature flag)

---

## Phase 5: Clean Up Admin Module (Week 8) 🟢 LOW

**Goal**: Admin module only contains generic admin logic

### Task 5.1: Move Remaining Admin Controllers

**Move**:
- `admin/webhook-admin.controller.ts` → `payments/admin/`
- `admin/tax-rules.controller.ts` → `tax/admin/` (done in Phase 3)
- `admin/shipping-methods.controller.ts` → `shipping/admin/` (done in Phase 3)
- `admin/reservations.controller.ts` → `inventory/admin/`

**Keep in AdminModule**:
- `admin/admin.controller.ts` (generic admin dashboard)

**Acceptance Criteria**:
- [ ] AdminModule has minimal dependencies
- [ ] Each domain owns its admin controllers
- [ ] Tests pass

**Estimate**: 2 days

---

### Task 5.2: Document Admin Endpoint Locations

**Create**: `docs/features/admin-endpoints.md`

List all admin endpoints and their locations after refactor.

**Estimate**: 0.5 days

---

**Week 8 Deliverable**: ✅ Clean admin module, documentation updated

---

## Phase 6: Enable Feature Flags in Production (Week 9-10)

**Goal**: Gradual rollout of refactored code

### Week 9: Enable in Staging

**.env.staging**:
```bash
FEATURE_FLAGS=tax_service_layer,shipping_service_layer
```

**Tasks**:
- Monitor logs for 1 week
- Run full test suite
- Check error rates

---

### Week 10: Enable in Production (Gradual)

**Day 1-2**: 5% traffic
```bash
FEATURE_FLAG_TAX_SERVICE_LAYER_PERCENTAGE=5
```

**Day 3-4**: 50% traffic
```bash
FEATURE_FLAG_TAX_SERVICE_LAYER_PERCENTAGE=50
```

**Day 5-7**: 100% traffic
```bash
FEATURE_FLAGS=tax_service_layer,shipping_service_layer
```

---

## Phase 7: Remove Old Code (Week 11-12)

**Goal**: Delete legacy implementations after 2 weeks at 100%

### Task 7.1: Remove Feature Flag Checks

**Before**:
```typescript
if (this.featureFlags.isEnabled('tax_service_layer')) {
  return this.taxService.findAll(params) // ✅
}
return this.legacyCode(params) // ⚠️ Delete this
```

**After**:
```typescript
return this.taxService.findAll(params) // Only this remains
```

**Estimate**: 2 days

---

### Task 7.2: Delete Old Services

Delete:
- Old inline Prisma queries in controllers
- Legacy service methods
- Unused imports

**Estimate**: 1 day

---

### Task 7.3: Remove Feature Flags

Delete feature flags that are 100% enabled and stable:
- `tax_service_layer`
- `shipping_service_layer`

Keep flags for:
- `orders_clean_architecture` (still experimental)
- `inventory_reservation_v2` (still experimental)

**Estimate**: 0.5 days

---

## Timeline Summary

| Phase | Duration | Status | Deliverable |
|-------|----------|--------|-------------|
| **Phase 0: Foundation** | Week 1 | 🎯 Ready | Feature flags, docs |
| **Phase 1: Break Circular Deps** | Week 2 | 🎯 Ready | Zero circular deps |
| **Phase 2: Extract Services** | Week 3-4 | 🎯 Ready | Controllers delegate to services |
| **Phase 3: Consolidate Modules** | Week 5 | 🎯 Ready | Consistent structure |
| **Phase 4: Domain Layer** | Week 6-7 | 🎯 Ready | Clean architecture (Orders) |
| **Phase 5: Clean Admin** | Week 8 | 🎯 Ready | Minimal admin module |
| **Phase 6: Production Rollout** | Week 9-10 | ⏳ Future | 100% traffic on new code |
| **Phase 7: Cleanup** | Week 11-12 | ⏳ Future | Old code deleted |

**Total Duration**: 12 weeks (3 months)

---

## Success Metrics

| Metric | Current | Week 4 Target | Week 8 Target | Week 12 Target |
|--------|---------|---------------|---------------|----------------|
| Circular dependencies | 1 | 0 | 0 | 0 |
| Controllers w/ Prisma | 5 | 0 | 0 | 0 |
| Feature flags active | 0 | 4 | 4 | 2 |
| Domain layers | 0 | 0 | 1 (Orders) | 1+ |
| Test coverage | ? | 50% | 60% | 70% |
| Documentation completeness | 20% | 60% | 80% | 90% |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| New code breaks production | Medium | High | Feature flags + gradual rollout |
| Migration takes longer than 12 weeks | Medium | Medium | Phases are independent, can slip |
| Team resistance to clean architecture | Low | Medium | Training + documentation |
| Old code harder to delete than expected | Low | Low | Keep feature flags until proven stable |

---

## What NOT to Touch

**Stable Modules** (leave as-is):
- ✅ `auth/` - Working correctly
- ✅ `cart/` - Simple, self-contained
- ✅ `products/` - Clean boundaries
- ✅ `email/` - Infrastructure service
- ✅ `prisma/` - Database client

**Postpone for Later**:
- Queue infrastructure refactoring
- Analytics optimization
- Webhook retry logic improvements
- Full domain layer for all modules (start with Orders only)

---

## Rollback Plan

If any phase fails:

1. **Immediate**: Disable feature flag in production
2. **Monitor**: Check if issue resolves
3. **Fix**: Debug in dev/staging
4. **Re-enable**: When fix verified

**Example**:
```bash
# Rollback tax service layer
FEATURE_FLAGS=shipping_service_layer # Remove tax_service_layer
```

---

## Next Steps

1. ✅ Review this migration plan with team
2. ⏭️ Start Phase 0: Implement feature flags
3. ⏭️ Create GitHub project board with tasks
4. ⏭️ Schedule weekly architecture review meetings

---

**Document Status**: Complete ✅  
**Ready for Execution**: Yes ✅  
**Next Action**: Implement `FeatureFlagsModule`
