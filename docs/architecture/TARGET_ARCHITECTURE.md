# Target Architecture - Backend Stabilization

**Date**: January 15, 2026  
**Status**: 🎯 Target State Definition  
**Architect**: Principal Software Architect  

---

## 1. Architectural Style

**Primary Style**: **Modular Monolith with Clean Architecture Principles**

**Why Not Microservices (Yet)**:
- Current codebase too tightly coupled
- Need to establish module boundaries first
- Monolith allows faster iteration during stabilization
- Can extract to microservices later (modules become services)

**Core Principles**:
1. **Dependency Inversion**: High-level modules don't depend on low-level modules
2. **Single Responsibility**: Each module owns one domain concept
3. **Explicit Dependencies**: No hidden coupling via shared databases
4. **Domain-Driven Boundaries**: Modules aligned with business capabilities

---

## 2. Layer Architecture

### 2.1 Four-Layer Model

```
┌─────────────────────────────────────────────┐
│         INTERFACE/API LAYER                 │  Controllers, DTOs, Guards
├─────────────────────────────────────────────┤
│         APPLICATION LAYER                   │  Use Cases, Orchestration
├─────────────────────────────────────────────┤
│         DOMAIN LAYER                        │  Entities, Value Objects, Interfaces
├─────────────────────────────────────────────┤
│         INFRASTRUCTURE LAYER                │  Prisma, Queues, External APIs
└─────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

#### Interface/API Layer
**Purpose**: Expose system to external consumers (HTTP, WebSocket, CLI)

**Components**:
- Controllers (request/response handling)
- DTOs (data transfer objects)
- Guards (authentication, authorization)
- Validation pipes
- Exception filters

**Rules**:
- ✅ Can call Application layer (use cases)
- ❌ Cannot call Infrastructure layer directly
- ❌ Cannot contain business logic
- ✅ Maps DTOs ↔ domain models

**Example**:
```typescript
@Controller('api/orders')
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase // ✅ Application layer
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    const command = this.mapToCommand(dto) // ✅ Map DTO
    return this.createOrderUseCase.execute(command) // ✅ Delegate
  }
}
```

---

#### Application Layer
**Purpose**: Orchestrate business workflows (use cases)

**Components**:
- Use case implementations
- Application services
- Command/query handlers
- Event publishers

**Rules**:
- ✅ Can call Domain layer
- ✅ Can call Infrastructure layer via interfaces
- ✅ Orchestrates multiple domain services
- ❌ No direct database access
- ❌ No HTTP-specific logic

**Example**:
```typescript
@Injectable()
export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,      // ✅ Interface
    private readonly taxCalculator: TaxCalculatorService,   // ✅ Domain service
    private readonly eventBus: EventBus                     // ✅ Infrastructure interface
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    // 1. Validate (domain logic)
    const order = Order.create(command)
    
    // 2. Calculate tax (domain service)
    const tax = await this.taxCalculator.calculate(order.address, order.subtotal)
    order.applyTax(tax)
    
    // 3. Persist (infrastructure)
    await this.orderRepository.save(order)
    
    // 4. Publish event (infrastructure)
    await this.eventBus.publish(new OrderCreatedEvent(order))
    
    return order
  }
}
```

---

#### Domain Layer
**Purpose**: Encapsulate business rules and domain knowledge

**Components**:
- Entities (aggregates)
- Value objects
- Domain services
- Domain events
- Repository interfaces
- Specifications

**Rules**:
- ✅ Pure business logic only
- ❌ No framework dependencies (NestJS, Prisma, etc.)
- ❌ No infrastructure concerns
- ✅ Can define interfaces for infrastructure
- ✅ Should be testable without mocks

**Example**:
```typescript
// Domain Entity
export class Order {
  private constructor(
    private readonly id: OrderId,
    private items: OrderItem[],
    private status: OrderStatus,
    private subtotal: Money,
    private tax: Money
  ) {}

  static create(params: CreateOrderParams): Order {
    // Business rules
    if (params.items.length === 0) {
      throw new DomainException('Order must have at least one item')
    }
    
    const subtotal = this.calculateSubtotal(params.items)
    
    return new Order(
      OrderId.generate(),
      params.items,
      OrderStatus.PENDING,
      subtotal,
      Money.zero()
    )
  }

  applyTax(tax: Money): void {
    // Business rule: tax cannot exceed subtotal
    if (tax.isGreaterThan(this.subtotal)) {
      throw new DomainException('Tax cannot exceed subtotal')
    }
    this.tax = tax
  }

  // More domain methods...
}

// Repository Interface (defined in domain, implemented in infrastructure)
export interface OrderRepository {
  save(order: Order): Promise<void>
  findById(id: OrderId): Promise<Order | null>
  findByUserId(userId: UserId): Promise<Order[]>
}
```

---

#### Infrastructure Layer
**Purpose**: Provide technical capabilities (database, queues, APIs)

**Components**:
- Repository implementations (Prisma)
- Queue services (Bull)
- External API clients (Stripe, Midtrans)
- File storage
- Email service
- Mappers (domain ↔ database models)

**Rules**:
- ✅ Implements interfaces defined in domain
- ✅ Contains framework-specific code
- ❌ No business logic
- ✅ Maps between domain models and persistence models

**Example**:
```typescript
@Injectable()
export class OrderRepositoryPrisma implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(order: Order): Promise<void> {
    const dbModel = OrderMapper.toPrisma(order) // ✅ Map domain → DB
    
    await this.prisma.order.upsert({
      where: { id: dbModel.id },
      update: dbModel,
      create: dbModel
    })
  }

  async findById(id: OrderId): Promise<Order | null> {
    const dbOrder = await this.prisma.order.findUnique({
      where: { id: id.value },
      include: { items: true }
    })
    
    if (!dbOrder) return null
    
    return OrderMapper.toDomain(dbOrder) // ✅ Map DB → domain
  }
}
```

---

## 3. Module Boundaries

### 3.1 Core Principle

**Each module is a vertical slice** containing all layers for one domain concept.

```
orders/
├── domain/
│   ├── order.entity.ts
│   ├── order-item.entity.ts
│   ├── order-status.value-object.ts
│   └── order.repository.interface.ts
├── application/
│   ├── use-cases/
│   │   ├── create-order.usecase.ts
│   │   ├── cancel-order.usecase.ts
│   │   └── process-payment.usecase.ts
│   └── services/
│       └── order-orchestrator.service.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── order.repository.prisma.ts
│   │   └── order.mapper.ts
│   └── events/
│       └── order-event-publisher.ts
├── interface/
│   ├── http/
│   │   ├── orders.controller.ts
│   │   ├── admin-orders.controller.ts
│   │   └── dto/
│   │       ├── create-order.dto.ts
│   │       └── order-response.dto.ts
│   └── events/
│       └── order-event.handler.ts
└── orders.module.ts
```

### 3.2 Dependency Rules

```
Interface  ──→  Application  ──→  Domain
                    ↓
              Infrastructure (implements domain interfaces)
```

**Strict Rules**:
1. **Domain** layer has zero dependencies
2. **Application** layer depends only on Domain
3. **Infrastructure** implements Domain interfaces
4. **Interface** depends on Application (not Infrastructure)

---

## 4. Module Catalog

### 4.1 Core Domain Modules

| Module | Responsibility | Status | Priority |
|--------|---------------|--------|----------|
| **Orders** | Order lifecycle, payment coordination | 🟡 Needs refactor | P0 |
| **Products** | Product catalog, stock management | ✅ Stable | - |
| **Cart** | Shopping cart, session management | ✅ Stable | - |
| **Inventory** | Stock reservation, allocation | 🟡 Needs extraction | P1 |
| **Fulfillment** | Order shipping, tracking | 🟡 Needs cleanup | P2 |

### 4.2 Supporting Domain Modules

| Module | Responsibility | Status | Priority |
|--------|---------------|--------|----------|
| **Tax** | Tax calculation by region | 🟡 Needs consolidation | P1 |
| **Shipping** | Shipping methods, cost calculation | 🟡 Needs consolidation | P1 |
| **Payments** | Payment provider abstraction | ✅ Good design | - |
| **Discounts** | Discount rules, application | ⚠️ Partial implementation | P3 |

### 4.3 Infrastructure Modules

| Module | Responsibility | Status | Priority |
|--------|---------------|--------|----------|
| **Queues** | Async job processing | ✅ Working | - |
| **Email** | Email delivery | ✅ Working | - |
| **Audit** | Audit logging | ✅ Working | - |
| **Auth** | Authentication, authorization | ✅ Stable | - |
| **Prisma** | Database client | ✅ Stable | - |

### 4.4 Cross-Cutting Modules

| Module | Responsibility | Status | Priority |
|--------|---------------|--------|----------|
| **FeatureFlags** | Feature toggle management | ❌ Missing | P0 |
| **Analytics** | Metrics, dashboards | 🟡 Needs service layer | P2 |
| **Webhooks** | Webhook management | 🟡 Scattered | P2 |

---

## 5. Dependency Flow (Target State)

### Orders Module Example

```
┌─────────────────────────────────────────┐
│  OrdersController (Interface)           │
│  - Maps HTTP → Commands                 │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  CreateOrderUseCase (Application)       │
│  - Orchestrates workflow                │
│  - Calls domain services                │
└───┬─────────────────┬───────────────────┘
    │                 │
    ▼                 ▼
┌─────────────┐   ┌──────────────────────┐
│  Order      │   │  TaxCalculator       │
│  (Domain)   │   │  (Domain Service)    │
└─────────────┘   └──────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  OrderRepository Interface (Domain)     │
└───────────┬─────────────────────────────┘
            │ implemented by
            ▼
┌─────────────────────────────────────────┐
│  OrderRepositoryPrisma (Infrastructure) │
│  - Prisma queries                       │
│  - Mapping logic                        │
└─────────────────────────────────────────┘
```

---

## 6. Anti-Patterns to Avoid

### ❌ **Controller → Prisma Direct Access**
```typescript
// BAD
@Controller()
export class OrdersController {
  constructor(private prisma: PrismaService) {}
  
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.prisma.order.findUnique({ where: { id } })
  }
}
```

**Why Bad**:
- Controller contains query logic
- Untestable without database
- Violates separation of concerns

**Correct**:
```typescript
// GOOD
@Controller()
export class OrdersController {
  constructor(private getOrderQuery: GetOrderQuery) {}
  
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.getOrderQuery.execute({ orderId: id })
  }
}
```

---

### ❌ **Circular Module Dependencies**
```typescript
// BAD
// orders.module.ts
imports: [AdminModule]

// admin.module.ts
imports: [OrdersModule]
```

**Why Bad**:
- Initialization order problems
- Can't extract modules
- Testing nightmare

**Correct**:
```typescript
// GOOD
// orders.module.ts
exports: [OrdersService]

// admin.module.ts
imports: [OrdersModule] // One-way dependency only
```

---

### ❌ **God Modules**
```typescript
// BAD
@Module({
  imports: [Module1, Module2, Module3, Module4, Module5],
  controllers: [Ctrl1, Ctrl2, Ctrl3, Ctrl4, Ctrl5, Ctrl6],
  providers: [Svc1, Svc2, Svc3, Svc4, Svc5, Svc6],
})
export class AdminModule {} // Knows too much, does too much
```

**Why Bad**:
- Unclear responsibility
- High coupling
- Hard to maintain

**Correct**: Each domain owns its admin controllers

---

### ❌ **forwardRef() Usage**
```typescript
// BAD
@Module({
  imports: [forwardRef(() => OrdersModule)],
})
export class PaymentsModule {}
```

**Why Bad**:
- Symptom of circular dependency
- Hides architectural problem
- Runtime initialization risk

**Correct**: Refactor to remove circular dependency

---

## 7. Module Communication Patterns

### 7.1 Synchronous Communication (Direct Dependency)

**When to Use**: Same transaction boundary, immediate response needed

```typescript
// orders.module.ts
@Module({
  imports: [TaxModule, ShippingModule], // ✅ Direct dependency
  providers: [CreateOrderUseCase],
})
export class OrdersModule {}

// create-order.usecase.ts
export class CreateOrderUseCase {
  constructor(
    private taxService: TaxService,         // ✅ Direct call
    private shippingService: ShippingService // ✅ Direct call
  ) {}
}
```

---

### 7.2 Asynchronous Communication (Event-Driven)

**When to Use**: Cross-bounded context, eventual consistency OK

```typescript
// orders/create-order.usecase.ts
async execute(command: CreateOrderCommand) {
  const order = await this.orderRepository.save(order)
  
  // ✅ Publish event instead of direct call
  await this.eventBus.publish(new OrderCreatedEvent({
    orderId: order.id,
    userId: order.userId,
    total: order.total
  }))
  
  return order
}

// analytics/order-created.handler.ts
@EventHandler(OrderCreatedEvent)
export class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent) {
    // ✅ Analytics module reacts independently
    await this.analyticsService.recordOrder(event)
  }
}
```

**Benefits**:
- Modules decoupled
- Can fail independently
- Easier to extract to microservices later

---

### 7.3 Queue-Based Communication

**When to Use**: Long-running tasks, retry logic needed

```typescript
// orders/process-payment.usecase.ts
async execute(command: ProcessPaymentCommand) {
  // ✅ Enqueue heavy work
  await this.paymentQueue.add('process-payment', {
    orderId: command.orderId,
    provider: command.provider
  })
}
```

---

## 8. Error Handling Strategy

### 8.1 Domain Exceptions

```typescript
// domain/exceptions/order.exceptions.ts
export class OrderDomainException extends DomainException {}
export class InvalidOrderStateException extends OrderDomainException {}
export class OrderNotFoundException extends OrderDomainException {}
```

### 8.2 Application Exceptions

```typescript
// application/exceptions/order.exceptions.ts
export class OrderApplicationException extends ApplicationException {}
export class OrderCreationFailedException extends OrderApplicationException {}
```

### 8.3 Exception Filter

```typescript
// common/filters/domain-exception.filter.ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    
    response.status(400).json({
      statusCode: 400,
      message: exception.message,
      error: 'Bad Request'
    })
  }
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (Domain Layer)

```typescript
describe('Order', () => {
  it('should calculate total correctly', () => {
    const order = Order.create({ items: [...], address: {...} })
    order.applyTax(Money.fromCents(100))
    
    expect(order.total).toEqual(Money.fromCents(1100))
  })
})
```

**No mocks needed** - Pure domain logic

---

### 9.2 Integration Tests (Application Layer)

```typescript
describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase
  let mockRepo: jest.Mocked<OrderRepository>
  
  beforeEach(() => {
    mockRepo = createMock<OrderRepository>()
    useCase = new CreateOrderUseCase(mockRepo, ...)
  })
  
  it('should create order with tax', async () => {
    const command = new CreateOrderCommand(...)
    const order = await useCase.execute(command)
    
    expect(mockRepo.save).toHaveBeenCalledWith(order)
  })
})
```

**Mock repositories** - Test orchestration logic

---

### 9.3 E2E Tests (API Layer)

```typescript
describe('/api/orders (e2e)', () => {
  it('POST /api/orders creates order', () => {
    return request(app.getHttpServer())
      .post('/api/orders')
      .send({ ... })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined()
      })
  })
})
```

**Real database** (test container) - Full stack test

---

## 10. Migration Strategy

### 10.1 Strangler Fig Pattern

**Principle**: Gradually replace old code without big-bang rewrite

```
┌─────────────────────────────────────┐
│  OLD: OrdersService (monolith)      │
│  - Mix of domain + infra            │
└──────────┬──────────────────────────┘
           │
           ▼ Extract gradually
┌─────────────────────────────────────┐
│  NEW: Clean Architecture            │
│  ├─ CreateOrderUseCase              │
│  ├─ Order (domain entity)           │
│  └─ OrderRepositoryPrisma           │
└─────────────────────────────────────┘
```

**Steps**:
1. Create new structure alongside old
2. Route new requests to new code
3. Gradually migrate old endpoints
4. Delete old code when 100% migrated

---

### 10.2 Feature Flags for Safe Migration

```typescript
@Injectable()
export class OrdersService {
  async createOrder(dto: CreateOrderDto) {
    if (this.featureFlags.isEnabled('orders_clean_architecture')) {
      return this.createOrderUseCase.execute(dto) // ✅ New
    }
    
    return this.legacyCreateOrder(dto) // ⚠️ Old (fallback)
  }
}
```

**Benefits**:
- Zero downtime
- Instant rollback if issues
- Gradual user migration

---

## 11. Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| **Zero circular dependencies** | Module graph analysis | 0 circles |
| **Layer violations** | ESLint rules | 0 violations |
| **Test coverage** | Jest coverage report | >70% |
| **Module cohesion** | Metrics analysis | High |
| **Code duplication** | SonarQube | <5% |
| **Documentation coverage** | Manual review | 90% of modules |

---

## 12. Next Steps

1. ✅ **Current State Analysis** - Complete
2. 🎯 **Target Architecture** - This document
3. ⏭️ **Migration Plan** - Step-by-step execution
4. ⏭️ **Feature Flag Implementation** - Safety net
5. ⏭️ **Refactor Priority 1 Issues** - Break circular deps

---

**Document Status**: Complete ✅  
**Next Document**: `MIGRATION_PLAN.md`
