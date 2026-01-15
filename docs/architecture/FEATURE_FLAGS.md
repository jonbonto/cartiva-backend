# Feature Flag System - Implementation Guide

**Date**: January 15, 2026  
**Status**: 🎯 Design & Implementation Ready  
**Priority**: P0 (Critical for safe refactoring)  

---

## 1. Overview

### Purpose

Feature flags enable **safe, gradual rollout** of refactored code alongside legacy implementations. Critical for **zero-downtime architecture recovery**.

### Benefits

- ✅ **Instant rollback** if new code has issues
- ✅ **Gradual migration** (5% → 50% → 100% traffic)
- ✅ **A/B testing** new implementations
- ✅ **Safe refactoring** (run old + new in parallel)
- ✅ **Per-user enablement** (beta testing)

---

## 2. Architecture

### 2.1 Flag Storage Strategy

**Phase 1 (Immediate)**: Environment variables + in-memory cache
- Simple, no new dependencies
- Restart required to change flags
- Good enough for refactoring

**Phase 2 (Future)**: Database + API
- Runtime flag changes
- Percentage-based rollouts
- User targeting

### 2.2 Module Structure

```
src/feature-flags/
├── feature-flags.module.ts
├── feature-flags.service.ts
├── feature-flags.config.ts
├── decorators/
│   └── feature-flag.decorator.ts
└── guards/
    └── feature-flag.guard.ts
```

---

## 3. Implementation

### 3.1 Feature Flag Service

```typescript
// src/feature-flags/feature-flags.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export enum FeatureFlag {
  // Architecture Refactoring Flags
  ORDERS_CLEAN_ARCHITECTURE = 'orders_clean_architecture',
  TAX_SERVICE_LAYER = 'tax_service_layer',
  SHIPPING_SERVICE_LAYER = 'shipping_service_layer',
  INVENTORY_RESERVATION_V2 = 'inventory_reservation_v2',
  
  // Feature Flags
  PAYMENT_STRIPE_V2 = 'payment_stripe_v2',
  ANALYTICS_REALTIME = 'analytics_realtime',
  EMAIL_QUEUE_PRIORITY = 'email_queue_priority',
}

interface FlagContext {
  userId?: string
  orderId?: string
  environment?: string
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name)
  private readonly flagCache = new Map<string, boolean>()
  
  constructor(private config: ConfigService) {
    this.loadFlags()
  }

  /**
   * Check if a feature flag is enabled globally
   */
  isEnabled(flag: FeatureFlag | string): boolean {
    const value = this.flagCache.get(flag)
    
    if (value === undefined) {
      this.logger.warn(`Flag not found: ${flag}, defaulting to false`)
      return false
    }
    
    return value
  }

  /**
   * Check if a feature flag is enabled for a specific context
   * (user, order, etc.)
   */
  isEnabledFor(flag: FeatureFlag | string, context: FlagContext): boolean {
    // Phase 1: Simple global flags
    const globalEnabled = this.isEnabled(flag)
    
    if (!globalEnabled) return false
    
    // Phase 2: Add percentage rollout logic here
    // Phase 3: Add user targeting logic here
    
    return globalEnabled
  }

  /**
   * Get all enabled flags (for debugging)
   */
  getEnabledFlags(): string[] {
    return Array.from(this.flagCache.entries())
      .filter(([_, enabled]) => enabled)
      .map(([flag]) => flag)
  }

  /**
   * Get flag value with detailed info
   */
  getFlagDetails(flag: FeatureFlag | string): {
    name: string
    enabled: boolean
    source: string
  } {
    return {
      name: flag,
      enabled: this.isEnabled(flag),
      source: 'environment'
    }
  }

  /**
   * Load flags from environment variables
   */
  private loadFlags(): void {
    // Load from FEATURE_FLAGS env var (comma-separated)
    const flagsEnv = this.config.get<string>('FEATURE_FLAGS', '')
    const enabledFlags = flagsEnv.split(',').map(f => f.trim()).filter(Boolean)
    
    // Initialize all flags to false
    Object.values(FeatureFlag).forEach(flag => {
      this.flagCache.set(flag, false)
    })
    
    // Enable flags from environment
    enabledFlags.forEach(flag => {
      if (Object.values(FeatureFlag).includes(flag as FeatureFlag)) {
        this.flagCache.set(flag, true)
        this.logger.log(`Feature flag enabled: ${flag}`)
      } else {
        this.logger.warn(`Unknown feature flag in env: ${flag}`)
      }
    })
    
    // Load individual flag overrides (FEATURE_FLAG_<NAME>=true/false)
    Object.values(FeatureFlag).forEach(flag => {
      const envKey = `FEATURE_FLAG_${flag.toUpperCase().replace(/\./g, '_')}`
      const envValue = this.config.get<string>(envKey)
      
      if (envValue !== undefined) {
        const enabled = envValue === 'true' || envValue === '1'
        this.flagCache.set(flag, enabled)
        this.logger.log(`Feature flag ${enabled ? 'enabled' : 'disabled'} via ${envKey}: ${flag}`)
      }
    })
    
    this.logger.log(`Loaded ${this.flagCache.size} feature flags`)
  }
}
```

### 3.2 Feature Flag Module

```typescript
// src/feature-flags/feature-flags.module.ts
import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FeatureFlagsService } from './feature-flags.service'

@Global() // Make available everywhere without explicit import
@Module({
  imports: [ConfigModule],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
```

### 3.3 Feature Flag Decorator

```typescript
// src/feature-flags/decorators/feature-flag.decorator.ts
import { SetMetadata } from '@nestjs/common'
import { FeatureFlag } from '../feature-flags.service'

export const FEATURE_FLAG_KEY = 'featureFlag'

export const RequiresFeatureFlag = (flag: FeatureFlag) =>
  SetMetadata(FEATURE_FLAG_KEY, flag)
```

### 3.4 Feature Flag Guard

```typescript
// src/feature-flags/guards/feature-flag.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FeatureFlagsService, FeatureFlag } from '../feature-flags.service'
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator'

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlags: FeatureFlagsService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFlag = this.reflector.get<FeatureFlag>(
      FEATURE_FLAG_KEY,
      context.getHandler()
    )

    if (!requiredFlag) {
      return true // No flag required
    }

    const isEnabled = this.featureFlags.isEnabled(requiredFlag)

    if (!isEnabled) {
      throw new NotFoundException('Feature not available')
    }

    return true
  }
}
```

---

## 4. Usage Patterns

### 4.1 Service Layer (Most Common)

```typescript
// orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    private featureFlags: FeatureFlagsService,
    private createOrderUseCase: CreateOrderUseCase,      // New
    private legacyCreateOrderService: LegacyOrderService // Old
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // ✅ Route to new or old implementation
    if (this.featureFlags.isEnabled(FeatureFlag.ORDERS_CLEAN_ARCHITECTURE)) {
      return this.createOrderUseCase.execute(dto)
    }
    
    return this.legacyCreateOrderService.createOrder(dto)
  }
}
```

### 4.2 Controller Endpoint (New Feature)

```typescript
// orders/orders.controller.ts
@Controller('api/orders')
export class OrdersController {
  constructor(private featureFlags: FeatureFlagsService) {}

  @Post('v2')
  @RequiresFeatureFlag(FeatureFlag.ORDERS_CLEAN_ARCHITECTURE)
  @UseGuards(FeatureFlagGuard)
  async createOrderV2(@Body() dto: CreateOrderDto) {
    // Only accessible if flag enabled
    return this.createOrderUseCase.execute(dto)
  }
}
```

### 4.3 Conditional Logic

```typescript
// inventory/inventory.service.ts
@Injectable()
export class InventoryService {
  async reserveStock(productId: number, quantity: number) {
    if (this.featureFlags.isEnabled(FeatureFlag.INVENTORY_RESERVATION_V2)) {
      // New: pessimistic locking + reservation table
      return this.reservationService.reserve(productId, quantity)
    }
    
    // Old: optimistic locking only
    return this.product.decrementStock(productId, quantity)
  }
}
```

### 4.4 Context-Based Flags

```typescript
// payments/payment.service.ts
async processPayment(orderId: string, userId: string) {
  const context = { orderId, userId }
  
  if (this.featureFlags.isEnabledFor(FeatureFlag.PAYMENT_STRIPE_V2, context)) {
    return this.stripeV2Provider.charge(order)
  }
  
  return this.stripeV1Provider.charge(order)
}
```

---

## 5. Environment Configuration

### 5.1 .env Setup

```bash
# Phase 1: Enable all refactored features
FEATURE_FLAGS=orders_clean_architecture,tax_service_layer,shipping_service_layer

# OR: Individual flag control
FEATURE_FLAG_ORDERS_CLEAN_ARCHITECTURE=true
FEATURE_FLAG_TAX_SERVICE_LAYER=false
FEATURE_FLAG_INVENTORY_RESERVATION_V2=false
```

### 5.2 Per-Environment Configs

**.env.development**:
```bash
# Enable all new features in dev
FEATURE_FLAGS=orders_clean_architecture,tax_service_layer,shipping_service_layer,inventory_reservation_v2
```

**.env.staging**:
```bash
# Gradual rollout in staging
FEATURE_FLAGS=orders_clean_architecture,tax_service_layer
```

**.env.production**:
```bash
# Conservative rollout in prod
FEATURE_FLAGS=
```

---

## 6. Migration Workflow

### Step 1: Implement New Code (Alongside Old)

```typescript
// DON'T delete old code yet
class OrdersService {
  async createOrder(dto) {
    if (flags.isEnabled('new_orders')) {
      return this.newImplementation(dto)  // ← Add this
    }
    return this.oldImplementation(dto)    // ← Keep this
  }
}
```

### Step 2: Deploy with Flag Disabled

```bash
# .env.production
FEATURE_FLAGS=  # Empty = all flags off
```

### Step 3: Enable in Dev/Staging First

```bash
# .env.development
FEATURE_FLAGS=new_orders
```

### Step 4: Monitor & Test

- Run full test suite
- Check logs for errors
- Monitor metrics

### Step 5: Gradual Prod Rollout

```bash
# Week 1: 5% traffic
FEATURE_FLAG_NEW_ORDERS_PERCENTAGE=5

# Week 2: 50% traffic
FEATURE_FLAG_NEW_ORDERS_PERCENTAGE=50

# Week 3: 100% traffic
FEATURE_FLAG_NEW_ORDERS_PERCENTAGE=100
```

### Step 6: Remove Old Code (After 2 Weeks at 100%)

```typescript
// Safe to delete old implementation
class OrdersService {
  async createOrder(dto) {
    return this.newImplementation(dto)  // Only this remains
  }
}
```

---

## 7. Flag Naming Conventions

### Pattern: `<domain>_<feature>_<version>`

**Examples**:
- `orders_clean_architecture` ← Refactoring flag
- `payment_stripe_v2` ← New provider version
- `inventory_reservation_v2` ← Algorithm change
- `analytics_realtime` ← New feature
- `email_queue_priority` ← Optimization

### Lifecycle:
1. **experimental** → Add flag
2. **beta** → Enable for subset
3. **stable** → Enable for all
4. **deprecated** → Remove flag + old code

---

## 8. Monitoring & Debugging

### 8.1 Debug Endpoint

```typescript
// feature-flags/feature-flags.controller.ts
@Controller('api/admin/feature-flags')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FeatureFlagsController {
  constructor(private featureFlags: FeatureFlagsService) {}

  @Get()
  getAllFlags() {
    return {
      enabled: this.featureFlags.getEnabledFlags(),
      all: Object.values(FeatureFlag).map(flag => ({
        name: flag,
        enabled: this.featureFlags.isEnabled(flag)
      }))
    }
  }

  @Get(':flag')
  getFlagDetails(@Param('flag') flag: string) {
    return this.featureFlags.getFlagDetails(flag)
  }
}
```

### 8.2 Logging

```typescript
async createOrder(dto: CreateOrderDto) {
  const useNewImplementation = this.featureFlags.isEnabled(
    FeatureFlag.ORDERS_CLEAN_ARCHITECTURE
  )
  
  this.logger.log(`Creating order with ${useNewImplementation ? 'NEW' : 'OLD'} implementation`)
  
  // ...
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests with Flags

```typescript
describe('OrdersService', () => {
  let service: OrdersService
  let mockFlags: jest.Mocked<FeatureFlagsService>

  beforeEach(() => {
    mockFlags = {
      isEnabled: jest.fn()
    } as any
    
    service = new OrdersService(mockFlags, ...)
  })

  it('should use new implementation when flag enabled', async () => {
    mockFlags.isEnabled.mockReturnValue(true)
    
    const result = await service.createOrder(dto)
    
    expect(result).toMatchSnapshot()
  })

  it('should use old implementation when flag disabled', async () => {
    mockFlags.isEnabled.mockReturnValue(false)
    
    const result = await service.createOrder(dto)
    
    expect(result).toMatchSnapshot()
  })
})
```

### 9.2 E2E Tests

```typescript
describe('Orders E2E (Feature Flags)', () => {
  beforeAll(() => {
    process.env.FEATURE_FLAGS = 'orders_clean_architecture'
  })

  it('POST /api/orders uses new implementation', () => {
    return request(app.getHttpServer())
      .post('/api/orders')
      .send(createOrderDto)
      .expect(201)
  })
})
```

---

## 10. Checklist for Adding a New Flag

- [ ] Define flag in `FeatureFlag` enum
- [ ] Add flag to `.env.example` with description
- [ ] Implement new code alongside old
- [ ] Wrap logic with `isEnabled()` check
- [ ] Add unit tests for both flag states
- [ ] Document flag in `/docs/decisions/adr-xxx.md`
- [ ] Test in dev with flag ON
- [ ] Deploy to prod with flag OFF
- [ ] Monitor for 24h
- [ ] Enable flag in prod
- [ ] Monitor for 2 weeks
- [ ] Remove old code + flag

---

## 11. Advanced: Percentage Rollouts (Phase 2)

```typescript
// Future enhancement
class FeatureFlagsService {
  isEnabledFor(flag: FeatureFlag, context: FlagContext): boolean {
    const percentage = this.getFlagPercentage(flag)
    
    if (percentage === 0) return false
    if (percentage === 100) return true
    
    // Hash userId to deterministic 0-100 value
    const userHash = this.hashUserId(context.userId)
    return userHash < percentage
  }
  
  private hashUserId(userId: string): number {
    // Consistent hash: same user always gets same result
    return Math.abs(hashCode(userId)) % 100
  }
}
```

---

## 12. Implementation Timeline

| Week | Task | Output |
|------|------|--------|
| **1** | Create FeatureFlagsModule | Working service |
| **1** | Add to AppModule | Global availability |
| **1** | Define initial flags | Enum with refactoring flags |
| **2** | Wrap orders refactoring | Feature flag check |
| **2** | Wrap tax refactoring | Feature flag check |
| **3** | Add admin debug endpoint | Monitor flags |
| **3** | Test with flags ON/OFF | Validation |
| **4** | Deploy to staging | Live testing |
| **5** | Enable in production | Gradual rollout |

---

**Document Status**: Complete ✅  
**Next Action**: Implement `FeatureFlagsModule` in codebase
