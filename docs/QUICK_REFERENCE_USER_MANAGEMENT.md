# Quick Reference Guide — User Address & Payment Methods

**Status**: ✅ Design Complete  
**Start Date**: January 20, 2026  
**Target Release**: February 28, 2026

---

## 📋 One-Page Overview

### What We're Building
User-managed shipping addresses and payment methods with feature-flagged rollout.

### Key Features
- ✅ Save multiple shipping addresses (CRUD, default selection)
- ✅ Save payment methods (tokenized, no raw card data)
- ✅ Use in orders checkout
- ✅ Backward compatible (existing checkout still works)
- ✅ Feature-flagged (safe gradual rollout)

### Timeline
| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | Database & Domain | Migration + entities + repos |
| 2 | Application | Use cases + DTOs + service |
| 3 | API | Controllers + Guards + Integration |
| 4 | Testing | Unit + Integration + Load tests |
| 5 | Staging | Beta testing + documentation |
| 6 | Production | Gradual rollout (Days 1-7) |

---

## 🗂 File Structure

```
src/users/ (NEW MODULE)
├── users.module.ts                           # Module definition
├── users.controller.ts                       # REST endpoints (6 operations)
├── users.service.ts                          # Business logic
│
├── domain/
│   ├── user.entity.ts                        # User aggregate root
│   ├── shipping-address.entity.ts            # Address entity
│   ├── payment-method.entity.ts              # Payment method entity
│   ├── user.repository.ts                    # Repository interface
│   └── user-profile.aggregate.ts             # Aggregate with invariants
│
├── application/
│   ├── use-cases/
│   │   ├── create-shipping-address.usecase.ts
│   │   ├── update-shipping-address.usecase.ts
│   │   ├── delete-shipping-address.usecase.ts
│   │   ├── set-default-address.usecase.ts
│   │   ├── add-payment-method.usecase.ts
│   │   ├── remove-payment-method.usecase.ts
│   │   └── set-default-payment-method.usecase.ts
│   └── dto/
│       ├── create-address.dto.ts
│       ├── update-address.dto.ts
│       ├── add-payment-method.dto.ts
│       ├── shipping-address-response.dto.ts
│       └── payment-method-response.dto.ts
│
├── infrastructure/
│   ├── user.repository.prisma.ts             # Prisma implementation
│   └── payment-provider.adapter.ts           # PSP integration
│
├── guards/
│   ├── address-owner.guard.ts                # Authorization
│   └── feature-user-addresses.guard.ts       # Feature flag
│
└── __tests__/
    ├── users.service.spec.ts                 # Unit tests
    ├── users.controller.integration.spec.ts  # Integration tests
    └── ...

docs/ (UPDATED)
├── EXECUTIVE_SUMMARY.md                      # This summary
├── USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md   # Complete design (40+ pages)
├── DATABASE_SCHEMA_USER_MANAGEMENT.md        # DB schema & migrations
└── IMPLEMENTATION_GUIDE.md                   # Step-by-step implementation
```

---

## 📊 Database Schema

### New Tables

#### UserShippingAddress
```sql
CREATE TABLE "UserShippingAddress" (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  label TEXT,
  fullName TEXT NOT NULL,
  streetLine1 TEXT NOT NULL,
  streetLine2 TEXT,
  city TEXT NOT NULL,
  stateProvince TEXT NOT NULL,
  postalCode TEXT NOT NULL,
  country TEXT NOT NULL,
  phoneNumber TEXT,
  isDefault BOOLEAN NOT NULL DEFAULT false,
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME,
  deletedAt DATETIME,
  
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  UNIQUE (userId, isDefault WHERE isDefault = true)
)
```

#### UserPaymentMethod
```sql
CREATE TABLE "UserPaymentMethod" (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  provider TEXT NOT NULL,           -- "stripe", "midtrans", etc.
  providerTokenId TEXT NOT NULL,    -- Never expose!
  type TEXT NOT NULL,               -- "card", "bank_transfer", etc.
  brand TEXT,                       -- "visa", "mastercard", etc.
  last4Digits TEXT,                 -- For display only
  expiryMonth INTEGER,
  expiryYear INTEGER,
  cardholderName TEXT,
  label TEXT,
  isDefault BOOLEAN NOT NULL DEFAULT false,
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME,
  deletedAt DATETIME,
  
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  UNIQUE (userId, isDefault WHERE isDefault = true)
)
```

---

## 🔌 API Endpoints (13 new)

### Shipping Addresses

```bash
# Create
POST /api/users/me/addresses
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Jane Doe",
  "streetLine1": "123 Main St",
  "streetLine2": "Apt 5B",          # optional
  "city": "New York",
  "stateProvince": "NY",
  "postalCode": "10001",
  "country": "US",                  # ISO 3166-1 alpha-2
  "phoneNumber": "+1234567890",     # optional
  "label": "Home"                   # optional
}

Response: 201 Created
{
  "id": "addr_abc123",
  "fullName": "Jane Doe",
  "label": "Home",
  "isDefault": true,                # First address auto-default
  "createdAt": "2026-01-19T15:45:00Z"
}
```

```bash
# List
GET /api/users/me/addresses
Authorization: Bearer <token>

Response: 200 OK
[{ ...address }, ...]
```

```bash
# Get
GET /api/users/me/addresses/:id
Authorization: Bearer <token>

Response: 200 OK
{ ...address }
```

```bash
# Update
PUT /api/users/me/addresses/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "fullName": "Jane Smith", ... }

Response: 200 OK
{ ...updated address }
```

```bash
# Delete (soft)
DELETE /api/users/me/addresses/:id
Authorization: Bearer <token>

Response: 204 No Content
```

```bash
# Set Default
PATCH /api/users/me/addresses/:id/default
Authorization: Bearer <token>

Response: 200 OK
{ ...address, "isDefault": true }
```

### Payment Methods

```bash
# Add (similar structure to addresses)
POST /api/users/me/payment-methods
{
  "provider": "stripe",
  "providerTokenId": "pm_1234abcd...",  # From Stripe.js
  "label": "My Visa"
}

Response: 201 Created
{
  "id": "pm_xyz",
  "provider": "stripe",
  "type": "card",
  "brand": "visa",
  "last4Digits": "4242",
  "expiryMonth": 12,
  "expiryYear": 2027,
  "isDefault": true,
  "createdAt": "2026-01-19T15:50:00Z"
  # Note: providerTokenId NEVER exposed
}
```

### Updated Checkout

```bash
# Option A: Use saved address
POST /api/orders/checkout
{
  "cartId": 1,
  "currency": "USD",
  "shippingAddressId": "addr_xyz",  # NEW
  "shippingMethodId": "ship_123"
}

# Option B: Inline (existing, still works)
POST /api/orders/checkout
{
  "cartId": 1,
  "currency": "USD",
  "shippingAddress": { ... },       # EXISTING
  "shippingMethodId": "ship_123"
}
```

---

## 🎯 Feature Flags

```env
# .env

# Addresses
FEATURE_USER_SHIPPING_ADDRESS=true|false  (default: false)

# Payment Methods
FEATURE_USER_PAYMENT_METHOD=true|false    (default: false)

# Use saved addresses in checkout
FEATURE_USER_SAVED_ADDRESSES_AT_CHECKOUT=true|false  (default: false)
```

**Rollout Schedule:**
- Week 1-2: Internal testing (all ON)
- Week 3: Staging (ADDRESS on, PAYMENT off)
- Week 4-5: Production limited (ADDRESS on, 50% users)
- Week 6+: Full rollout (all ON, 100% users)

---

## 🔐 Authorization Rules

### User Can:
- ✅ Create own addresses
- ✅ Read own addresses
- ✅ Update own addresses
- ✅ Delete (soft) own addresses
- ✅ Set own default

### User Cannot:
- ❌ Access others' addresses (403)
- ❌ Delete address in active order (400)
- ❌ Update address after order created

### Admin Can:
- ✅ View all addresses (audit)
- ✅ Soft-delete if abuse detected

---

## 🏗 Architecture Rules

### Dependency Flow (UNIDIRECTIONAL)

```
Users Module (OWNS addresses, payment methods)
    ↓ (read-only)
    ├─→ Orders Module (reads addresses for snapshot)
    └─→ Payments Module (reads payment methods for charging)
    
❌ FORBIDDEN: Orders → Users (mutate)
❌ FORBIDDEN: Payments → Users (mutate)
```

### Key Invariants

1. **One default per user**: Database unique constraint + application validation
2. **Address immutable after order**: Application-level enforcement
3. **Payment token never exposed**: DTO filtering
4. **No raw card data**: Only PSP tokens + metadata

---

## 🧪 Testing Checklist

### Unit Tests (85%+ coverage)
- [ ] ShippingAddress entity (create, update, setDefault, softDelete)
- [ ] PaymentMethod entity (same)
- [ ] Use cases (each CRUD operation)
- [ ] DTO validation (required fields, formats)
- [ ] Repository interface compliance

### Integration Tests (75%+ coverage)
- [ ] Create address → List → Update → Set default
- [ ] Authorization: Can't access others' addresses
- [ ] Can't delete address in active order
- [ ] Checkout with saved address ID resolves correctly
- [ ] Payment with saved method ID resolves correctly

### Load Tests
- [ ] Create 1000 addresses per user (< 2 sec)
- [ ] List 1000 addresses (< 100ms)
- [ ] Set default among 500 addresses (< 100ms)
- [ ] Payment provider token lookup 100 concurrent (< 500ms each)

### Regression Tests
- [ ] Existing checkout (no shippingAddressId) still works
- [ ] Existing payment flow unchanged
- [ ] Feature flags OFF: endpoints 403
- [ ] All Phase 1-6 tests still pass

---

## 🚀 Week 1 Deliverables

### By End of Week 1

- ✅ Prisma migration created & tested
- ✅ Domain entities implemented (ShippingAddress, PaymentMethod, User)
- ✅ Repository interface defined
- ✅ Feature flags added to enum
- ✅ All domain logic tested (unit tests)

### By End of Week 2

- ✅ Prisma repository implemented
- ✅ All use cases implemented
- ✅ DTOs & validators
- ✅ UsersService
- ✅ Unit + integration tests passing

### By End of Week 3

- ✅ UsersController endpoints
- ✅ Authorization guards
- ✅ Orders integration
- ✅ Payments integration
- ✅ Feature flags wired

### By End of Week 4

- ✅ Load tests passing
- ✅ Security audit
- ✅ All tests passing (85%+ unit, 75%+ integration)
- ✅ No new circular dependencies

### By End of Week 5

- ✅ Staging deployment
- ✅ Beta testing complete
- ✅ Documentation finalized
- ✅ Monitoring configured

### By End of Week 6

- ✅ Production rollout
- ✅ Feature flags: ADDRESS on (100%)
- ✅ Monitor 7 days
- ✅ Enable PAYMENT flag if no issues

---

## 📖 Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) | High-level overview, decisions, FAQ | All |
| [USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md](./USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md) | Complete design (40+ pages) | Engineers, Architects |
| [DATABASE_SCHEMA_USER_MANAGEMENT.md](./DATABASE_SCHEMA_USER_MANAGEMENT.md) | Schema, migrations, performance | DB Engineers |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Week-by-week checklist | Implementation Team |
| This file | Quick reference | All |

---

## ⚠️ Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing checkout | Feature flag OFF by default; inline addresses still work |
| Raw card data stored | Only PSP tokens; no card numbers ever stored |
| Authorization bypass | Guard on every endpoint; ownership verified |
| Circular dependencies | Unidirectional flow enforced; no back-refs from Orders/Payments |
| Performance degradation | Indexes on userId, isActive, isDefault; load tests planned |
| Data migration issues | Additive schema; no backfill needed; reversible migration |

---

## 🎬 Getting Started

### For Architects
1. Read [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) (this file)
2. Review Phase 3 & 4 in [USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md](./USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md)
3. Approve design & dependencies

### For Engineers
1. Read [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) Week 1
2. Start with [DATABASE_SCHEMA_USER_MANAGEMENT.md](./DATABASE_SCHEMA_USER_MANAGEMENT.md)
3. Create Prisma migration

### For QA
1. Review [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) Testing Strategy
2. Create test plans for Week 4+
3. Coordinate staging tests (Week 5)

---

## 📞 Questions?

Refer to:
- **API Spec**: Phase 5 of [USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md](./USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md)
- **Database**: [DATABASE_SCHEMA_USER_MANAGEMENT.md](./DATABASE_SCHEMA_USER_MANAGEMENT.md)
- **Implementation**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- **FAQ**: [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) Appendix

---

**Version**: 1.0  
**Date**: January 19, 2026  
**Status**: ✅ Ready to Start Implementation
