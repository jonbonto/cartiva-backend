# Phase 2 Readiness: Extract Service Layer

**Status**: 🎯 READY TO START  
**Duration**: 2 weeks (Weeks 2-3)  
**Effort**: 6-8 days of work (3 services × 1.5-2 days each)  
**Risk**: 🟡 MEDIUM (high complexity, mitigated with feature flags)  

---

## Phase 2 Objective

**Current Problem**: Controllers directly access PrismaService  
**Goal**: Introduce service layer between controllers and data access  
**Benefit**: Improved testability, reusability, separation of concerns

---

## Current Architecture (Problem)

```typescript
// ❌ CURRENT: Direct controller → Prisma access
@Controller('api/admin/tax-rules')
export class TaxRulesController {
  constructor(private prisma: PrismaService) {}  // Direct access!
  
  @Get()
  async list() {
    return this.prisma.taxRule.findMany()  // Direct query
  }
}
```

---

## Target Architecture (Solution)

```typescript
// ✅ TARGET: Controller → Service → Prisma
@Controller('api/admin/tax-rules')
export class TaxRulesController {
  constructor(private taxRulesAdminService: TaxRulesAdminService) {}
  
  @Get()
  async list() {
    return this.taxRulesAdminService.list()  // Through service
  }
}

@Injectable()
export class TaxRulesAdminService {
  constructor(private prisma: PrismaService) {}
  
  async list() {
    return this.prisma.taxRule.findMany()
  }
}
```

---

## Phase 2 Tasks

### Task 1: Extract TaxRulesAdminService ⏳ PRIORITY 1

**File**: `src/admin/tax-rules.controller.ts`  
**New Service**: `src/admin/services/tax-rules-admin.service.ts`  

**Current Controller Methods**:
1. `list()` - GET /api/admin/tax-rules
2. `create(body)` - POST /api/admin/tax-rules
3. `update(id, body)` - PATCH /api/admin/tax-rules/:id
4. `delete(id)` - DELETE /api/admin/tax-rules/:id

**Service Methods** (extract from controller):
- `listTaxRules(filters, sort, pagination)`
- `createTaxRule(data)`
- `updateTaxRule(id, data)`
- `deleteTaxRule(id)`
- `validateTaxRuleData(data)` (helper)

**Feature Flag**: `tax_service_layer`
```typescript
// In controller, conditionally use new service
if (this.featureFlags.isEnabled(FeatureFlag.TAX_SERVICE_LAYER)) {
  return this.taxRulesAdminService.listTaxRules(...)
} else {
  return this.oldImplementation()  // Keep old code for rollback
}
```

**Estimated Effort**: 1.5-2 days

---

### Task 2: Extract ShippingMethodsAdminService ⏳ PRIORITY 2

**File**: `src/admin/shipping-methods.controller.ts`  
**New Service**: `src/admin/services/shipping-methods-admin.service.ts`  

**Current Controller Methods**:
1. `list()` - GET /api/admin/shipping-methods
2. `create(body)` - POST /api/admin/shipping-methods
3. `update(id, body)` - PATCH /api/admin/shipping-methods/:id
4. `delete(id)` - DELETE /api/admin/shipping-methods/:id

**Service Methods**:
- `listShippingMethods(filters, sort, pagination)`
- `createShippingMethod(data)`
- `updateShippingMethod(id, data)`
- `deleteShippingMethod(id)`
- `validateShippingMethodData(data)` (helper)

**Feature Flag**: `shipping_service_layer`

**Estimated Effort**: 1.5-2 days

---

### Task 3: Extract InventoryReservationsAdminService ⏳ PRIORITY 3

**File**: `src/admin/reservations.controller.ts`  
**New Service**: `src/admin/services/inventory-reservations-admin.service.ts`  

**Current Controller Methods**:
1. `list()` - GET /api/admin/reservations
2. `release(id, body)` - POST /api/admin/reservations/:id/release

**Service Methods**:
- `listReservations(filters, sort, pagination)`
- `releaseReservation(id, reason)`
- `validateReleaseReason(reason)` (helper)

**Feature Flag**: `inventory_reservation_v2`

**Estimated Effort**: 1.5 days

---

### Task 4: Unit Tests (Parallel)

**For Each Service**:
- Test list/filter functionality
- Test create validation
- Test update/delete operations
- Test error handling

**Coverage Goal**: 80%+ for each service

**Note**: Can be done in parallel with Task 1-3

---

## Detailed Steps (Task 1 Example: TaxRulesAdminService)

### Step 1: Create Service File

```bash
touch src/admin/services/tax-rules-admin.service.ts
```

**Content**:
```typescript
import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class TaxRulesAdminService {
  constructor(private prisma: PrismaService) {}

  async listTaxRules(
    filters?: { country?: string },
    sort?: { by: string; order: 'asc' | 'desc' },
    pagination?: { limit: number; offset: number }
  ) {
    // Extract from controller's list() method
  }

  async createTaxRule(data: CreateTaxRuleDto) {
    // Extract from controller's create() method
  }

  async updateTaxRule(id: string, data: UpdateTaxRuleDto) {
    // Extract from controller's update() method
  }

  async deleteTaxRule(id: string) {
    // Extract from controller's delete() method
  }
}
```

### Step 2: Register Service in Module

**File**: `src/admin/admin.module.ts`

```typescript
import { TaxRulesAdminService } from './services/tax-rules-admin.service'

@Module({
  providers: [
    // ... existing providers
    TaxRulesAdminService,  // ← Add here
  ],
})
export class AdminModule {}
```

### Step 3: Update Controller

**File**: `src/admin/tax-rules.controller.ts`

```typescript
import { TaxRulesAdminService } from './services/tax-rules-admin.service'
import { FeatureFlagsService } from '../feature-flags/feature-flags.service'
import { FeatureFlag } from '../feature-flags/feature-flags.service'

@Controller('api/admin/tax-rules')
export class TaxRulesController {
  constructor(
    private taxRulesAdminService: TaxRulesAdminService,
    private featureFlags: FeatureFlagsService,
    private prisma: PrismaService  // Keep for fallback
  ) {}

  @Get()
  async list(@Query('country') country?: string) {
    // Use feature flag to choose implementation
    if (this.featureFlags.isEnabled(FeatureFlag.TAX_SERVICE_LAYER)) {
      return this.taxRulesAdminService.listTaxRules({ country })
    }
    
    // Fallback to old implementation (keep for rollback)
    return this.prisma.taxRule.findMany(...)
  }
}
```

### Step 4: Test & Verify

```bash
npm test -- tax-rules.controller  # Unit tests
npm test -- tax-rules-admin.service  # Service tests
npm run build  # Verify compilation
```

### Step 5: Deploy & Monitor

```bash
# Set in production environment
FEATURE_FLAG_TAX_SERVICE_LAYER=false  # Start disabled

# Then gradually enable:
# 5% users → 50% → 100%
```

---

## Rollout Strategy

### Week 1 (Dev Environment)
- Implement all 3 services
- Write unit tests
- Verify build

### Week 2 (Staging)
- Deploy with feature flags disabled
- Test with production data (anonymized)
- Monitor error rates, latency

### Week 3 (Production - Gradual Rollout)

**Day 1**: 5% of traffic
```
FEATURE_FLAGS=tax_service_layer,shipping_service_layer,inventory_reservation_v2
FEATURE_FLAG_TAX_SERVICE_LAYER=false  # Start at 5%
# OR use context-based rollout: isEnabledFor(userId) - return Math.random() < 0.05
```

**Day 3**: 50% of traffic (if no issues)
```
# Increase percentage to 50%
```

**Day 5**: 100% of traffic (if no issues)
```
# Full rollout
FEATURE_FLAG_TAX_SERVICE_LAYER=true
```

**Week 4**: Remove old code
```
# After 1-2 weeks at 100%, remove feature flag check
# Delete fallback implementation from controller
```

---

## Success Criteria

### Phase 2 Complete When:

✅ All 3 services extracted and registered  
✅ Unit tests pass (80%+ coverage)  
✅ Build successful (0 TypeScript errors)  
✅ Controllers use services (no direct Prisma access)  
✅ Feature flags working (can toggle services)  
✅ Production rollout successful (no error spikes)  

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing endpoints | Feature flags provide instant rollback |
| Database query changes | Services encapsulate logic, easier to test |
| Performance regression | Monitor latency metrics during rollout |
| Missing edge cases | Comprehensive unit tests before deployment |
| Rollback difficulty | Keep old code for 2 weeks, then delete safely |

---

## Pre-requisites

✅ **Completed**:
- Feature flag system (ready to use)
- Phase 1 (circular dependencies broken)
- Build infrastructure (tested)

⏳ **Need**:
- Unit test framework setup (Jest configured)
- DTOs for request validation (may exist)
- Error handling patterns (standardized)

---

## Timeline Estimate

```
Phase 2: Extract Service Layer (2 weeks)

Week 2 (Jan 22-26):
  Mon-Tue: Task 1 - TaxRulesAdminService (1.5 days)
  Wed-Thu: Task 2 - ShippingMethodsAdminService (1.5 days)
  Fri:     Task 3 - InventoryReservationsAdminService (0.5 days)
  
Week 3 (Jan 29-Feb 2):
  Mon-Tue: Task 4 - Unit tests all services (2 days)
  Wed:     Integration testing (1 day)
  Thu:     Deploy to staging (0.5 days)
  Fri:     Production rollout (5% traffic) (1 day)
```

---

## Deliverables

**By End of Phase 2**:

1. ✅ 3 new service files created & registered
2. ✅ 3 controllers refactored to use services
3. ✅ Comprehensive unit tests (80%+ coverage)
4. ✅ Feature flags working and tested
5. ✅ Production rollout plan executed
6. ✅ Documentation updated (phase-2-service-layer.md)
7. ✅ Commit ready for merge with detailed PR description

---

## Commands to Remember

```bash
# Start phase 2 work
git checkout -b feat/architecture-recovery-phase-2

# Build and test frequently
npm run build
npm test

# Check for new circular deps (should still be 0)
npx madge --circular src/

# When ready to commit
git commit -m "Phase 2: Extract service layer for tax/shipping/inventory"
git push origin feat/architecture-recovery-phase-2
```

---

## Next Phase Preview (Phase 3)

After Phase 2 completes, Phase 3 will:
- Consolidate tax/shipping module structure
- Ensure all controllers → services (extract remaining ones)
- Improve module organization
- Estimated: 1 week

---

## Questions Before Starting?

1. **Should we start Phase 2 this week?** → Recommended yes
2. **Which task to start first?** → Task 1 (TaxRulesAdminService) is most straightforward
3. **Need to involve QA?** → For staging testing (Week 3)
4. **Need to notify users?** → No (no API changes)

---

**Phase 2 Status**: 🎯 **READY TO START**  
**Confidence Level**: 🟢 **HIGH**  
**Recommendation**: **START THIS WEEK**

---

**Prepared by**: Architecture Recovery Initiative  
**Date**: January 15, 2026  
**Target Start**: January 22, 2026
