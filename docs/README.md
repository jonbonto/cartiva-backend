# Backend Documentation - Single Source of Truth

**Last Updated**: January 15, 2026  
**Status**: 📚 Centralized Documentation  
**Owner**: Engineering Team  
**Project Status**: ✅ **Phase 0-1 Complete** (Circular dependency eliminated, feature flags ready)

---

## 🎯 Start Here

**New to this project?** Follow this path:
1. **[Quick Reference](./QUICK_REFERENCE.md)** ← Start here for status overview
2. **[Architecture Recovery Summary](./ARCHITECTURE_RECOVERY_SUMMARY.md)** ← Comprehensive summary
3. **[Phase 2 Readiness](./PHASE_2_READINESS.md)** ← What's next (detailed plan)

**Project Status Documents**:
- **[Phase 0 Complete](./PHASE_0_COMPLETE.md)** - Foundation & feature flags ✅
- **[Phase 1 Complete](./PHASE_1_COMPLETE.md)** - Circular dependency eliminated ✅
- **[Weekly Status](./WEEKLY_STATUS_WEEK_1.md)** - Progress tracking

---

## 📋 Quick Links

| Document | Purpose | Status |
|----------|---------|--------|
| **[Current State Analysis](./architecture/CURRENT_STATE_ANALYSIS.md)** | Architecture problems & technical debt | ✅ Complete |
| **[Target Architecture](./architecture/TARGET_ARCHITECTURE.md)** | Clean architecture principles & patterns | ✅ Complete |
| **[Migration Plan](./architecture/MIGRATION_PLAN.md)** | Step-by-step refactoring guide (12 weeks) | ✅ Complete |
| **[Feature Flags](./architecture/FEATURE_FLAGS.md)** | Feature flag implementation & usage | ✅ Complete |

---

## 🏗️ Architecture Documentation

### Core Documents
- **[Current State Analysis](./architecture/CURRENT_STATE_ANALYSIS.md)**
  - Module inventory & dependency graph
  - Critical violations (circular deps, layer violations)
  - Technical debt inventory
  - Risk assessment

- **[Target Architecture](./architecture/TARGET_ARCHITECTURE.md)**
  - Four-layer clean architecture model
  - Module boundaries & dependency rules
  - Anti-patterns to avoid
  - Testing strategy

- **[Migration Plan](./architecture/MIGRATION_PLAN.md)**
  - 12-week phased migration
  - Task breakdown with estimates
  - Feature flag rollout strategy
  - Rollback procedures

- **[Feature Flags Guide](./architecture/FEATURE_FLAGS.md)**
  - Implementation details
  - Usage patterns
  - Gradual rollout strategy
  - Testing with flags

### Principles
- **[Dependency Rules](./architecture/principles.md)** _(TODO)_
- **[Module Boundaries](./architecture/module-boundaries.md)** _(TODO)_
- **[Error Handling Standards](./architecture/error-handling.md)** _(TODO)_

---

## 📐 Feature Documentation

### Core Commerce

- **[Orders Feature](./features/orders.md)** _(TODO)_
  - Order lifecycle
  - Payment coordination
  - Status transitions
  - Current status: 🟡 Needs refactoring

- **[Cart Feature](./features/cart.md)** _(TODO)_
  - Session management
  - Item operations
  - Current status: ✅ Stable

- **[Products Feature](./features/products.md)** _(TODO)_
  - Catalog management
  - Stock tracking
  - Current status: ✅ Stable

### Payment & Finance

- **[Payments Feature](./features/payments.md)** _(TODO)_
  - Payment providers (Stripe, Midtrans)
  - Webhook handling
  - Idempotency
  - Current status: ✅ Good design

- **[Tax Calculation](./features/tax.md)** _(TODO)_
  - Region-based tax rules
  - Calculation logic
  - Current status: 🟡 Needs consolidation

- **[Discounts Feature](./features/discounts.md)** _(TODO)_
  - Discount rules
  - Stacking logic
  - Current status: ⚠️ Partial implementation

### Fulfillment & Logistics

- **[Shipping Feature](./features/shipping.md)** _(TODO)_
  - Shipping methods
  - Cost calculation
  - Current status: 🟡 Needs consolidation

- **[Fulfillment Feature](./features/fulfillment.md)** _(TODO)_
  - Order shipping workflow
  - Tracking integration
  - Current status: 🟡 Needs cleanup

- **[Inventory Reservations](./features/inventory.md)** _(TODO)_
  - Stock locking
  - Auto-release logic
  - Current status: 🟡 Needs extraction

### Infrastructure

- **[Queue System](./features/queues.md)** _(TODO)_
  - Queue modules (Email, Webhook, Analytics, Orders)
  - Retry strategies
  - Monitoring
  - Current status: ✅ Working

- **[Email Service](./features/email.md)** _(TODO)_
  - Template system
  - SendGrid integration
  - Current status: ✅ Working

- **[Audit Logging](./features/audit.md)** _(TODO)_
  - Admin action tracking
  - Immutable audit trail
  - Current status: ✅ Working

### Analytics & Reporting

- **[Analytics Feature](./features/analytics.md)** _(TODO)_
  - Snapshot aggregation
  - Dashboard metrics
  - Current status: 🟡 Needs service layer

---

## 🗺️ Phase Documentation

### Historical Phases (As Implemented)

- **[Phase 1-2: Core Commerce](./phases/phase-1-2-core-commerce.md)** _(TODO)_
  - Products, Cart, Basic Orders
  
- **[Phase 3: Admin & Audit](./phases/phase-3-admin-audit.md)** _(TODO)_
  - Admin endpoints, audit logging

- **[Phase 4: Architecture Hardening](./phases/phase-4-architecture.md)** _(TODO)_
  - Payment providers, webhooks

- **[Phase 5: Orders & Payments](./phases/phase-5-orders-payments.md)** _(TODO)_
  - Payment integration, refunds

- **[Phase 6: Tax, Shipping, Inventory](./phases/phase-6-tax-shipping-inventory.md)** _(TODO)_
  - Regional tax, shipping methods, stock reservations

- **[Phase 7: Fulfillment & Analytics](./phases/phase-7-fulfillment-analytics.md)** _(TODO)_
  - Order tracking, analytics snapshots

### Stabilization Phases (New)

- **[Phase 0: Foundation](./phases/phase-0-stabilization.md)** _(TODO)_
  - Feature flags, documentation, ESLint rules

- **[Future Phases Roadmap](./phases/future-roadmap.md)** _(TODO)_
  - Domain layer expansion
  - Event sourcing
  - Microservices extraction

---

## 🧠 Architecture Decision Records (ADRs)

Track **why** we made certain decisions.

### Format
```markdown
# ADR-XXX: Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded

## Context
What problem are we solving?

## Decision
What did we decide?

## Consequences
What are the tradeoffs?

## Alternatives Considered
What else did we evaluate?
```

### ADRs

- **[ADR-001: Queue vs Sync for Payment Webhooks](./decisions/adr-001-queue-vs-sync.md)** _(TODO)_
  - Decision: Use queues for reliability
  
- **[ADR-002: Feature Flag Strategy](./decisions/adr-002-feature-flags.md)** _(TODO)_
  - Decision: Environment-based flags (Phase 1), DB-based (Phase 2)

- **[ADR-003: Clean Architecture Adoption](./decisions/adr-003-clean-architecture.md)** _(TODO)_
  - Decision: Four-layer model, strangler fig migration

- **[ADR-004: Repository Pattern](./decisions/adr-004-repository-pattern.md)** _(TODO)_
  - Decision: Interface in domain, implementation in infrastructure

- **[ADR-005: Prisma as ORM](./decisions/adr-005-prisma-orm.md)** _(TODO)_
  - Decision: Use Prisma for type safety + migrations

---

## 📊 Current System Status

### Architecture Health

| Metric | Status | Target | Notes |
|--------|--------|--------|-------|
| **Circular Dependencies** | 🔴 1 | 0 | Orders ↔ Admin |
| **Layer Violations** | 🔴 5 | 0 | Controllers → Prisma |
| **Test Coverage** | ❓ Unknown | 70% | Need baseline |
| **Module Cohesion** | 🟡 Medium | High | Scattered logic |
| **Documentation** | 🟡 40% | 90% | In progress |

### Module Stability Status

| Module | Status | Needs Work | Priority |
|--------|--------|------------|----------|
| **Products** | ✅ Stable | None | - |
| **Cart** | ✅ Stable | None | - |
| **Auth** | ✅ Stable | None | - |
| **Payments** | ✅ Good | Minor cleanup | P3 |
| **Orders** | 🟡 Working | Refactor to clean arch | P0 |
| **Tax** | 🟡 Working | Consolidate module | P1 |
| **Shipping** | 🟡 Working | Consolidate module | P1 |
| **Fulfillment** | 🟡 Working | Extract queue logic | P2 |
| **Inventory** | 🟡 Working | Extract to own module | P1 |
| **Admin** | 🟡 Working | Break apart god module | P2 |
| **Analytics** | 🟡 Working | Add service layer | P2 |
| **Queues** | ✅ Working | None | - |
| **Email** | ✅ Working | None | - |

---

## 🚀 Getting Started

### For New Developers

1. **Read**: [Current State Analysis](./architecture/CURRENT_STATE_ANALYSIS.md)
   - Understand current architecture problems
   - See dependency graph
   
2. **Read**: [Target Architecture](./architecture/TARGET_ARCHITECTURE.md)
   - Learn clean architecture principles
   - Understand layer responsibilities

3. **Read**: [Migration Plan](./architecture/MIGRATION_PLAN.md)
   - See refactoring roadmap
   - Understand what's changing

4. **Review**: Feature docs for modules you'll work on

5. **Follow**: ADRs to understand why decisions were made

---

### For Contributing to Refactor

1. **Check**: [Migration Plan](./architecture/MIGRATION_PLAN.md) for current phase
2. **Use**: [Feature Flags](./architecture/FEATURE_FLAGS.md) for safe deployment
3. **Test**: Both old and new implementations
4. **Document**: Update feature docs when changing modules
5. **Review**: Target architecture before implementing

---

## 📚 Documentation Standards

### File Naming
- Use kebab-case: `current-state-analysis.md`
- Prefix ADRs with number: `adr-001-topic.md`
- Feature docs use feature name: `orders.md`

### Document Structure
Every feature doc should have:
1. **Overview** - What is this feature?
2. **Current Status** - Stable | Experimental | Deprecated
3. **Architecture** - How is it structured?
4. **Dependencies** - What does it depend on?
5. **Feature Flags** - Any flags controlling this feature?
6. **API Documentation** - Endpoints exposed
7. **Known Issues** - Current problems
8. **Future Work** - Planned improvements

---

## 🔄 Keeping Docs Updated

### When to Update

- ✅ **Always** update when changing architecture
- ✅ **Always** update when adding/removing features
- ✅ **Always** create ADR for significant decisions
- ✅ **Weekly** review doc accuracy in team meetings

### Who Updates

- **Architects**: Architecture docs
- **Feature Owners**: Feature docs
- **Tech Leads**: ADRs
- **Everyone**: Fix typos, improve clarity

---

## 📞 Questions?

- **Architecture Questions**: See [Current State Analysis](./architecture/CURRENT_STATE_ANALYSIS.md)
- **Implementation Questions**: See [Target Architecture](./architecture/TARGET_ARCHITECTURE.md)
- **Migration Questions**: See [Migration Plan](./architecture/MIGRATION_PLAN.md)
- **Feature Questions**: See [Features](./features/)
- **Design Decision Questions**: See [ADRs](./decisions/)

---

## 🗂️ Folder Structure

```
docs/
├── README.md                           ← This file
├── architecture/
│   ├── CURRENT_STATE_ANALYSIS.md       ✅ Complete
│   ├── TARGET_ARCHITECTURE.md          ✅ Complete
│   ├── MIGRATION_PLAN.md               ✅ Complete
│   ├── FEATURE_FLAGS.md                ✅ Complete
│   ├── principles.md                   ⏳ TODO
│   ├── module-boundaries.md            ⏳ TODO
│   └── error-handling.md               ⏳ TODO
├── features/
│   ├── orders.md                       ⏳ TODO
│   ├── payments.md                     ⏳ TODO
│   ├── cart.md                         ⏳ TODO
│   ├── products.md                     ⏳ TODO
│   ├── tax.md                          ⏳ TODO
│   ├── shipping.md                     ⏳ TODO
│   ├── inventory.md                    ⏳ TODO
│   ├── fulfillment.md                  ⏳ TODO
│   ├── analytics.md                    ⏳ TODO
│   ├── queues.md                       ⏳ TODO
│   ├── email.md                        ⏳ TODO
│   └── audit.md                        ⏳ TODO
├── phases/
│   ├── phase-0-stabilization.md        ⏳ TODO
│   ├── phase-1-2-core-commerce.md      ⏳ TODO
│   ├── phase-3-admin-audit.md          ⏳ TODO
│   ├── phase-4-architecture.md         ⏳ TODO
│   ├── phase-5-orders-payments.md      ⏳ TODO
│   ├── phase-6-tax-shipping-inventory.md ⏳ TODO
│   ├── phase-7-fulfillment-analytics.md ⏳ TODO
│   └── future-roadmap.md               ⏳ TODO
└── decisions/
    ├── adr-001-queue-vs-sync.md        ⏳ TODO
    ├── adr-002-feature-flags.md        ⏳ TODO
    ├── adr-003-clean-architecture.md   ⏳ TODO
    ├── adr-004-repository-pattern.md   ⏳ TODO
    └── adr-005-prisma-orm.md           ⏳ TODO
```

---

**Last Updated**: January 15, 2026  
**Documentation Completeness**: 40% (Core architecture docs complete, feature docs pending)  
**Next Priority**: Implement Phase 0 (Feature Flags), then document existing features
