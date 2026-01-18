# Prisma Schema Updates — User Addresses & Payment Methods

## Overview

This document details the database schema changes required to support user-managed shipping addresses and payment methods.

---

## New Tables

### 1. UserShippingAddress

**Purpose:** User-owned, reusable shipping addresses

```prisma
model UserShippingAddress {
  id              String   @id @default(cuid())
  
  /// User who owns this address
  userId          Int
  user            User     @relation(name: "UserShippingAddresses", fields: [userId], references: [id], onDelete: Cascade)
  
  /// Address Details
  label           String?  /// "Home", "Work", "Mom's Place", etc.
  fullName        String
  streetLine1     String
  streetLine2     String?
  city            String
  stateProvince   String
  postalCode      String
  country         String   /// ISO 3166-1 alpha-2
  phoneNumber     String?
  
  /// Metadata
  isDefault       Boolean  @default(false)
  isActive        Boolean  @default(true)
  
  /// Audit Trail
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  @@index([userId])
  @@index([isActive])
  @@index([deletedAt])
  @@unique([userId, isDefault])  /// Only one default per user
}
```

**Indexes:**
- `userId` — Fast lookup of user's addresses
- `isActive` — Soft delete queries
- `deletedAt` — Audit trail queries
- `(userId, isDefault)` — Enforce single default

**Constraints:**
- Cascade delete when user deleted
- Only one default per user (unique constraint)

---

### 2. UserPaymentMethod

**Purpose:** User-owned payment method references (tokens from PSP)

```prisma
model UserPaymentMethod {
  id              String   @id @default(cuid())
  
  /// User who owns this payment method
  userId          Int
  user            User     @relation(name: "UserPaymentMethods", fields: [userId], references: [id], onDelete: Cascade)
  
  /// Payment Provider & Token
  provider        String   /// "stripe", "midtrans", "paypal", etc.
  providerTokenId String   /// External token (e.g., "pm_1234...", never expose to user)
  
  /// Metadata (for display, not for payment)
  type            String   /// "card", "bank_transfer", "e_wallet", etc.
  brand           String?  /// "visa", "mastercard", "gopay", etc.
  last4Digits     String?  /// "4242" for masked display
  expiryMonth     Int?
  expiryYear      Int?
  cardholderName  String?
  
  /// Billing Address (optional, provider-specific)
  billingStreetLine1 String?
  billingStreetLine2 String?
  billingCity        String?
  billingStateProvince String?
  billingPostalCode   String?
  billingCountry      String?
  
  /// User-facing label
  label           String?  /// "My Visa", "Backup Card", etc.
  
  /// Metadata
  isDefault       Boolean  @default(false)
  isActive        Boolean  @default(true)  /// Can disable without deletion
  
  /// Audit Trail
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  @@index([userId])
  @@index([provider])
  @@index([isActive])
  @@unique([userId, isDefault])  /// Only one default per user
}
```

**Indexes:**
- `userId` — Fast lookup of user's payment methods
- `provider` — Query by payment provider
- `isActive` — Active/inactive queries
- `(userId, isDefault)` — Enforce single default

**Constraints:**
- Cascade delete when user deleted
- Only one default per user (unique constraint)
- `providerTokenId` never exposed in API responses

---

## Modified Tables

### User Table

**Current:**
```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  auditLogs AdminAuditLog[]
  orders    Order[]
}
```

**Updated (Add Relations):**
```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  /// NEW: Address & Payment Management
  shippingAddresses  UserShippingAddress[]  @relation("UserShippingAddresses")
  paymentMethods     UserPaymentMethod[]    @relation("UserPaymentMethods")
  
  /// Existing
  auditLogs AdminAuditLog[]
  orders    Order[]
}
```

---

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         User                                │
│  id, name, email, password, role                            │
└──────────────────────┬──────────────────────────────────────┘
       │ 1 user to N
       ├─────────────────────────┬─────────────────────────────┐
       │                         │                             │
       ▼                         ▼                             ▼
┌──────────────────┐   ┌──────────────────┐    ┌────────────────────┐
│ Order (existing) │   │UserShippingAddress   │ │UserPaymentMethod   │
│                  │   │(NEW)              │ │(NEW)             │
│ id               │   │                   │ │                  │
│ userId ──────┐   │   │ id                │ │ id               │
│              │   │   │ userId            │ │ userId           │
└──────────────┼───┘   │ label, fullName   │ │ provider         │
               │       │ street1, street2  │ │ providerTokenId  │
               │       │ city, stateCode   │ │ type, brand      │
               │       │ postalCode        │ │ last4Digits      │
               │       │ country           │ │ expiryMonth/Year │
               │       │ isDefault         │ │ label            │
               │       │ isActive          │ │ isDefault        │
               │       │ createdAt, updatedAt   │ isActive         │
               │       │ deletedAt         │ │ createdAt, updatedAt
               │       │                   │ │ deletedAt        │
               │       └───────────────────┘ └────────────────────┘
               │
               │ 1 order to 0..1 shipping address (snapshot)
               ▼
┌──────────────────────────────────┐
│     ShippingAddress (existing)    │
│  (immutable snapshot at checkout) │
│                                  │
│ id, orderId (unique)             │
│ fullName, street, city, etc.     │
└──────────────────────────────────┘
```

---

## Prisma Migration

### Migration File

**Name:** `20260119_add_user_addresses_and_payment_methods`

```prisma
// prisma/migrations/20260119_add_user_addresses_and_payment_methods/migration.sql

-- CreateTable UserShippingAddress
CREATE TABLE "UserShippingAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "streetLine1" TEXT NOT NULL,
    "streetLine2" TEXT,
    "city" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UserShippingAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable UserPaymentMethod
CREATE TABLE "UserPaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTokenId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "last4Digits" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "cardholderName" TEXT,
    "billingStreetLine1" TEXT,
    "billingStreetLine2" TEXT,
    "billingCity" TEXT,
    "billingStateProvince" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex for UserShippingAddress
CREATE INDEX "UserShippingAddress_userId_idx" ON "UserShippingAddress"("userId");
CREATE INDEX "UserShippingAddress_isActive_idx" ON "UserShippingAddress"("isActive");
CREATE INDEX "UserShippingAddress_deletedAt_idx" ON "UserShippingAddress"("deletedAt");
CREATE UNIQUE INDEX "UserShippingAddress_userId_isDefault_key" ON "UserShippingAddress"("userId", "isDefault") WHERE "isDefault" = true;

-- CreateIndex for UserPaymentMethod
CREATE INDEX "UserPaymentMethod_userId_idx" ON "UserPaymentMethod"("userId");
CREATE INDEX "UserPaymentMethod_provider_idx" ON "UserPaymentMethod"("provider");
CREATE INDEX "UserPaymentMethod_isActive_idx" ON "UserPaymentMethod"("isActive");
CREATE UNIQUE INDEX "UserPaymentMethod_userId_isDefault_key" ON "UserPaymentMethod"("userId", "isDefault") WHERE "isDefault" = true;

-- AddRelation to User
ALTER TABLE "User" ADD COLUMN "shippingAddresses" TEXT;
ALTER TABLE "User" ADD COLUMN "paymentMethods" TEXT;
```

---

## Backward Compatibility

### No Data Migration Required

**Why:**
- Existing `ShippingAddress` table unchanged (still stores order snapshots)
- New tables are purely additive
- Existing orders unaffected
- No data needs backfilling

### Existing Users

**Day 0 (After Migration):**
```sql
SELECT COUNT(*) FROM "UserShippingAddress";  -- 0 rows
SELECT COUNT(*) FROM "UserPaymentMethod";    -- 0 rows
SELECT COUNT(*) FROM "User";                 -- existing users, unaffected
```

**As Users Adopt:**
```sql
-- After users start creating addresses/methods
SELECT COUNT(*) FROM "UserShippingAddress" WHERE "createdAt" > '2026-01-19';
SELECT COUNT(*) FROM "UserPaymentMethod" WHERE "createdAt" > '2026-01-19';
```

---

## Performance Considerations

### Indexes

| Index | Reason | Priority |
|-------|--------|----------|
| `(userId)` | List user's addresses/methods | HIGH |
| `(isActive)` | Filter active only | HIGH |
| `(userId, isDefault)` | Find default quickly | HIGH |
| `(deletedAt)` | Soft-delete queries | MEDIUM |
| `(provider)` | Payment method by provider | MEDIUM |

### Query Performance

```sql
-- Fast: Find user's default address (< 1ms)
SELECT * FROM "UserShippingAddress" 
WHERE "userId" = 123 AND "isDefault" = true LIMIT 1;

-- Fast: List user's addresses (< 10ms for 1000 addresses)
SELECT * FROM "UserShippingAddress" 
WHERE "userId" = 123 AND "isActive" = true 
ORDER BY "createdAt" DESC;

-- Fast: Get specific address (< 1ms)
SELECT * FROM "UserShippingAddress" 
WHERE "id" = 'addr_xyz' AND "userId" = 123;
```

### Storage Estimate

```
Per UserShippingAddress row:  ~300 bytes
Per UserPaymentMethod row:    ~350 bytes

For 1M users with:
  - Avg 3 addresses each: 3M rows × 300B = ~900MB
  - Avg 2 payment methods: 2M rows × 350B = ~700MB
  - Total: ~1.6GB (negligible)
```

---

## Rollback Plan

### If Migration Fails

```bash
# Rollback to previous schema
npx prisma migrate resolve --rolled-back 20260119_add_user_addresses_and_payment_methods
```

### What Happens

1. New tables dropped
2. User relations removed
3. Schema reverted to pre-migration state
4. Existing data (ShippingAddress, Payment, etc.) unchanged

---

## Validation Checklist

After migration, verify:

```sql
-- 1. New tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'User%';

-- 2. Indexes created
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'UserShippingAddress%';

-- 3. Foreign keys configured
PRAGMA foreign_key_list(UserShippingAddress);  -- Should show User reference

-- 4. Unique constraints
SELECT sql FROM sqlite_master WHERE type='index' AND name='UserShippingAddress_userId_isDefault_key';

-- 5. Data integrity (should be empty after fresh migration)
SELECT COUNT(*) FROM "UserShippingAddress";    -- 0
SELECT COUNT(*) FROM "UserPaymentMethod";      -- 0

-- 6. Existing data untouched
SELECT COUNT(*) FROM "User";                   -- Should match pre-migration count
SELECT COUNT(*) FROM "Order";                  -- Should match pre-migration count
SELECT COUNT(*) FROM "ShippingAddress" WHERE "orderId" IS NOT NULL;  -- Order snapshots untouched
```

---

## Integration with Prisma Client

### Generated Types

After migration, Prisma generates types:

```typescript
// @prisma/client (auto-generated)
export interface UserShippingAddress {
  id: string
  userId: number
  label: string | null
  fullName: string
  streetLine1: string
  streetLine2: string | null
  city: string
  stateProvince: string
  postalCode: string
  country: string
  phoneNumber: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface UserPaymentMethod {
  id: string
  userId: number
  provider: string
  providerTokenId: string  // Never expose!
  type: string
  brand: string | null
  last4Digits: string | null
  expiryMonth: number | null
  expiryYear: number | null
  cardholderName: string | null
  // ... billing fields
  label: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
```

### Usage Example

```typescript
// Query user's default address
const defaultAddress = await prisma.userShippingAddress.findFirst({
  where: {
    userId: 123,
    isDefault: true,
    isActive: true,
  },
})

// Create address
const newAddress = await prisma.userShippingAddress.create({
  data: {
    userId: 123,
    fullName: "Jane Doe",
    streetLine1: "123 Main St",
    city: "New York",
    stateProvince: "NY",
    postalCode: "10001",
    country: "US",
    isDefault: false,  // Will be set to true if first
  },
})

// Soft delete
await prisma.userShippingAddress.update({
  where: { id: 'addr_xyz' },
  data: {
    isActive: false,
    deletedAt: new Date(),
  },
})
```

---

**Version**: 1.0  
**Date**: January 19, 2026  
**Status**: Ready for Application
