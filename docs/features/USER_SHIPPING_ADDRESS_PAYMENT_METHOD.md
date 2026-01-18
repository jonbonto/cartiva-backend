# User Shipping Address & Payment Method Management — Complete Design Document

**Date**: January 19, 2026  
**Status**: 🟡 Design Phase (Ready for Implementation)  
**Author**: Senior Architect

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Codebase Analysis](#phase-1-codebase-analysis)
3. [Phase 2: Domain Modeling](#phase-2-domain-modeling)
4. [Phase 3: Architecture & Dependency Rules](#phase-3-architecture--dependency-rules)
5. [Phase 4: Module & Folder Structure](#phase-4-module--folder-structure)
6. [Phase 5: API Design](#phase-5-api-design)
7. [Phase 6: Feature Flags & Rollout](#phase-6-feature-flags--rollout)
8. [Phase 7: Documentation](#phase-7-documentation)
9. [Phase 8: Migration & Compatibility](#phase-8-migration--compatibility)
10. [Implementation Timeline](#implementation-timeline)

---

## Executive Summary

This document designs a **backward-compatible, modular system** for managing user shipping addresses and payment methods in our e-commerce backend.

### Key Features

- ✅ **User-owned shipping addresses** — Create, update, delete, set default
- ✅ **User-owned payment methods** — Save, delete, set default (tokenized, no raw card data)
- ✅ **Clean domain separation** — No circular dependencies
- ✅ **Feature-flagged rollout** — Safe production deployment
- ✅ **Read-only consumption** — Orders/Checkout snapshot data at purchase time
- ✅ **Future-ready** — Billing vs shipping addresses, multi-PSP support

### Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│ PRINCIPLE 1: Single Responsibility                              │
│ - User module OWNS addresses and payment methods                │
│ - Orders/Payments READ immutable snapshots                      │
│ - No back-references from Orders → User management              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PRINCIPLE 2: Immutable Snapshots at Checkout                    │
│ - Address is copied to ShippingAddress table at order creation  │
│ - Payment method is referenced (not copied) at payment time     │
│ - Allows user to change future orders independently             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PRINCIPLE 3: PSP Agnostic Payment Tokens                        │
│ - Tokens stored by provider (Stripe → Stripe, Midtrans → etc.)  │
│ - No raw card data ever in our database                         │
│ - Payment method is just a reference to external token          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PRINCIPLE 4: Feature-Flagged Safe Rollout                       │
│ - Flags: user_shipping_address, user_payment_method             │
│ - Default: OFF (gradual enablement)                             │
│ - Existing checkout still works (no addresses required)         │
└─────────────────────────────────────────────────────────────────┘
```

---

# Phase 1: Codebase Analysis

## 1.1 Current State Snapshot

### Database Schema (Current)

**Relevant tables:**
- `User` — Basic auth model (id, name, email, password, role)
- `Order` — Order snapshot (userId required, items, totals)
- `ShippingAddress` — One-to-one with Order (immutable snapshot)
- `Payment` — Payment record (orderId, provider, status)
- `ShippingMethod` — Shipping options
- `TaxRule` — Tax rates by region

**Missing tables:**
- `UserShippingAddress` — User-owned, reusable addresses
- `UserPaymentMethod` — User-owned payment methods (tokens)

### Current Module Dependencies

```
AppModule
├── AuthModule ✅ Clean
├── UserModule ❌ DOESN'T EXIST YET
├── OrdersModule ⚠️ Creates ShippingAddress snapshot
├── PaymentsModule ⚠️ References external tokens only
├── ShippingModule ✅ Clean (readonly)
├── TaxModule ✅ Clean (readonly)
└── ... others
```

### Circular Dependency Risk Analysis

```
✅ LOW RISK — New modules can be designed to avoid:
   - OrdersModule → UserModule (one-way, read shipping address)
   - PaymentsModule → UserModule (one-way, read payment method)
   - OrdersModule does NOT mutate User data
   - PaymentsModule does NOT mutate User data

❌ HIGH RISK (Existing) — Admin ↔ Orders circular
   - Noted in CURRENT_STATE_ANALYSIS.md
   - NEW features will NOT increase this risk
```

### Extension Points Identified

1. **Auth/User Module** — Natural home for address/payment methods
2. **Checkout Flow** — Already accepts optional `shippingAddress`
3. **Payment Initiation** — Can accept `paymentMethodId` (new)
4. **Order Snapshot** — Already persists `ShippingAddress` (reuse pattern)
5. **Feature Flags** — Already in place for rollout

### Key Observations

| Component | Status | Notes |
|-----------|--------|-------|
| **Prisma Schema** | ✅ Ready | `ShippingAddress` exists, payment tokens ready |
| **Order Model** | ✅ Ready | Immutable snapshots already pattern |
| **Payment Flow** | ✅ Ready | Provider abstraction exists (PaymentProviderRegistry) |
| **Shipping Service** | ✅ Ready | Read-only, no mutations |
| **Feature Flags** | ✅ Ready | System in place, enum updatable |
| **Circular Dependencies** | ⚠️ Existing | Will NOT add new ones |

---

# Phase 2: Domain Modeling

## 2.1 Entity Definitions

### User Shipping Address

**Purpose**: Reusable, user-managed address for checkout and future orders

```typescript
/**
 * UserShippingAddress Entity
 * 
 * Represents a physical address stored by a user for future checkout.
 * Can be used multiple times across multiple orders.
 * Soft-deleted for audit trail.
 */
interface UserShippingAddress {
  id: string                    // UUID or CUID
  userId: number                // Required: who owns this
  
  // Core Address Data
  label?: string                // "Home", "Work", "Mom's House", etc.
  fullName: string              // Recipient name
  streetLine1: string           // Street address
  streetLine2?: string          // Apartment, Suite, etc.
  city: string
  stateProvince: string         // State/Province/Region code
  postalCode: string
  country: string               // ISO 3166-1 alpha-2 (US, CA, etc.)
  phoneNumber?: string
  
  // Metadata
  isDefault: boolean            // Auto-selected at checkout
  isActive: boolean             // Soft delete flag
  
  // Audit
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt?: DateTime          // Soft delete timestamp
}
```

**Invariants:**
- ✅ One default address per user (enforced at application layer)
- ✅ User can have 0-N addresses
- ✅ Address cannot be mutated after order creation (snapshot pattern)
- ✅ Can be soft-deleted for audit trail

**Ownership Rules:**
```
User owns the address
├── User can create (POST)
├── User can read (GET)
├── User can update (PUT) — only if not referenced in active orders
├── User can delete (DELETE) — soft delete
└── Admin can view/manage (audit purposes)
```

---

### User Payment Method

**Purpose**: Save tokenized payment methods for future checkout

```typescript
/**
 * UserPaymentMethod Entity
 * 
 * Represents a saved payment method (tokenized by external PSP).
 * Stores reference to token, NOT raw card data.
 * Supports multiple providers (Stripe, Midtrans, PayPal, etc.).
 */
interface UserPaymentMethod {
  id: string                    // UUID or CUID
  userId: number                // Required: who owns this
  
  // Provider & Token
  provider: string              // "stripe", "midtrans", "paypal", etc.
  providerTokenId: string       // External token from PSP (e.g., "pm_1234...")
  
  // Metadata (for display, not for payment)
  type: string                  // "card", "bank_transfer", "e_wallet", etc.
  brand?: string                // "visa", "mastercard", "gopay", etc.
  last4Digits?: string          // "4242" for cards
  expiryMonth?: number
  expiryYear?: number
  cardholderName?: string
  
  // Billing Address (optional, PSP-specific)
  billingAddress?: {
    streetLine1: string
    streetLine2?: string
    city: string
    stateProvince?: string
    postalCode: string
    country: string
  }
  
  // Metadata
  label?: string                // "My Visa", "Backup Card", etc.
  isDefault: boolean            // Auto-selected at checkout
  isActive: boolean             // Can be disabled without deletion
  
  // Audit
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt?: DateTime          // Soft delete (can't reuse after)
}
```

**Invariants:**
- ✅ Zero raw card data stored
- ✅ Token must be valid with provider
- ✅ One default payment method per user (enforced at application layer)
- ✅ Can be soft-deleted but not reactivated
- ✅ Provider-agnostic (supports any PSP)

**Ownership Rules:**
```
User owns the payment method
├── User can create (POST) — must include valid provider & token
├── User can read (GET) — masked display only
├── User CANNOT update (no mutations after creation)
├── User can delete (DELETE) — soft delete only
└── Only Payment module can invoke provider verification
```

---

## 2.2 Aggregate Boundaries

### UserProfile Aggregate

```typescript
/**
 * UserProfile Aggregate
 * 
 * Root: User
 * 
 * Responsibilities:
 * - Owns user account & auth
 * - Owns shipping addresses (collection)
 * - Owns payment methods (collection)
 * - Enforces "default" invariants
 */
interface UserProfile {
  user: User
  shippingAddresses: UserShippingAddress[]
  paymentMethods: UserPaymentMethod[]
  
  // Invariants
  defaultShippingAddressId?: string  // Must exist in collection
  defaultPaymentMethodId?: string     // Must exist in collection
}
```

**Operations:**
```typescript
// Shipping Addresses
aggregate.addShippingAddress(address: CreateAddressDto): UserShippingAddress
aggregate.updateShippingAddress(id: string, updates: UpdateAddressDto): UserShippingAddress
aggregate.deleteShippingAddress(id: string): void
aggregate.setDefaultAddress(id: string): void

// Payment Methods
aggregate.addPaymentMethod(method: CreatePaymentMethodDto): UserPaymentMethod
aggregate.removePaymentMethod(id: string): void
aggregate.setDefaultPaymentMethod(id: string): void

// Queries
aggregate.getDefaultShippingAddress(): UserShippingAddress | null
aggregate.getDefaultPaymentMethod(): UserPaymentMethod | null
aggregate.listShippingAddresses(active?: boolean): UserShippingAddress[]
aggregate.listPaymentMethods(active?: boolean): UserPaymentMethod[]
```

**Invariant Enforcement:**
```typescript
// When setting default address
if (newDefaultId && !addresses.find(a => a.id === newDefaultId)) {
  throw new InvalidAddressError('Address not found in user profile')
}

// When adding address
if (addresses.length === 0) {
  // First address becomes default
  address.isDefault = true
}

// When deleting address
if (address.isDefault && addresses.length > 1) {
  // Move default to first remaining
  addresses[0].isDefault = true
}
```

---

## 2.3 Versioning & Future Extensions

### Billing Addresses (Phase 9+)

```typescript
// Current: Only shipping addresses
interface UserShippingAddress { ... }

// Future: Support billing too
interface UserAddress {
  id: string
  userId: number
  type: 'shipping' | 'billing'  // NEW: can be used for both
  // ... rest same
}

// Migration: One-way, additive
// - Keep UserShippingAddress table
// - Add UserAddress table
// - Orders can reference either (for migration period)
```

### Subscription Addresses

```typescript
// Future: Recurring shipments
interface SubscriptionAddress {
  id: string
  subscriptionId: string
  addressId: string                    // References UserAddress
  useFrequency: 'each_shipment' | 'fixed'
  instructions?: string
  
  userAddress: UserAddress
}
```

---

# Phase 3: Architecture & Dependency Rules

## 3.1 Module Ownership

### Users Module (NEW)

**Responsibilities:**
```
✅ OWNS:
   - User shipping addresses (CRUD)
   - User payment methods (CRUD)
   - User profile queries
   - Default address/payment enforcement

❌ DOES NOT:
   - Create orders
   - Process payments
   - Manage shipping calculations
   - Store raw card data
```

**Public Interface:**
```typescript
// Users Module exports
export class UsersService {
  // Shipping Addresses
  async createShippingAddress(userId: number, dto: CreateAddressDto): Promise<UserShippingAddress>
  async getShippingAddress(userId: number, addressId: string): Promise<UserShippingAddress>
  async listShippingAddresses(userId: number, options?: ListOptions): Promise<UserShippingAddress[]>
  async updateShippingAddress(userId: number, addressId: string, dto: UpdateAddressDto): Promise<UserShippingAddress>
  async deleteShippingAddress(userId: number, addressId: string): Promise<void>
  async setDefaultShippingAddress(userId: number, addressId: string): Promise<void>
  
  // Payment Methods
  async addPaymentMethod(userId: number, dto: AddPaymentMethodDto): Promise<UserPaymentMethod>
  async getPaymentMethod(userId: number, methodId: string): Promise<UserPaymentMethod>
  async listPaymentMethods(userId: number, active?: boolean): Promise<UserPaymentMethod[]>
  async removePaymentMethod(userId: number, methodId: string): Promise<void>
  async setDefaultPaymentMethod(userId: number, methodId: string): Promise<void>
  
  // Internal: For read-only access by Orders/Payments
  async getShippingAddressForSnapshot(userId: number, addressId: string): Promise<ReadOnlyAddress>
  async getPaymentMethodForCharge(userId: number, methodId: string): Promise<ReadOnlyPaymentMethod>
}
```

### Orders Module (UPDATED)

**Current Behavior:**
- Creates `ShippingAddress` snapshot at order time (read from request)
- Accepts optional `shippingMethodId`

**New Behavior:**
```
✅ CAN:
   - Accept optional shippingAddressId (reference to user's saved address)
   - Copy user's address to ShippingAddress snapshot
   - Accept optional paymentMethodId (reference to user's saved method)
   - Pass paymentMethodId to Payments module

❌ CANNOT:
   - Create/update/delete user addresses
   - Create/update/delete user payment methods
   - Enforce defaults
   - Store raw card data
```

**Backward Compatibility:**
```typescript
// OLD: Pass full address inline
POST /api/orders/checkout
{
  cartId: 1,
  shippingAddress: {
    fullName: "Jane Doe",
    streetLine1: "123 Main St",
    ...
  }
}

// NEW: Also support saved address
POST /api/orders/checkout
{
  cartId: 1,
  shippingAddressId: "addr_xyz"  // NEW: reference to saved
}

// Both work — Orders module handles resolution
```

### Payments Module (UPDATED)

**Current Behavior:**
- Creates `Payment` record
- Calls provider to create payment intent

**New Behavior:**
```
✅ CAN:
   - Accept optional paymentMethodId (reference to user's saved method)
   - Query Users module to get payment method token
   - Pass token to provider for charge

❌ CANNOT:
   - Create/update/delete user payment methods
   - Store raw card data
   - Enforce defaults
```

---

## 3.2 Dependency Rules

### Unidirectional Flow (CRITICAL)

```
┌─────────────────┐
│   Users Module  │ (OWNS addresses, payment methods)
│  (root domain)  │
└────────┬────────┘
         │ (unidirectional read-only)
         ├──→ Orders Module (reads addresses)
         └──→ Payments Module (reads payment methods)
```

**Rule:** No module can call back to Users service to mutate

```typescript
// ✅ ALLOWED
class OrdersService {
  constructor(private usersService: UsersService) {}
  
  async createOrderFromCart(userId, cartId, dto) {
    // Read-only
    const address = await this.usersService.getShippingAddressForSnapshot(userId, dto.shippingAddressId)
    // Create snapshot
    const shippingAddress = ShippingAddress.create(address)
    // ...
  }
}

// ❌ FORBIDDEN
class OrdersService {
  async createOrderFromCart(userId, cartId, dto) {
    // NEVER update user data
    await this.usersService.updateShippingAddress(userId, ...)  // ❌
  }
}
```

### Module Imports

```typescript
// app.module.ts
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
    UsersModule,           // NEW
    CartModule,
    ProductsModule,
    OrdersModule,          // UPDATED: imports UsersModule (readonly)
    PaymentsModule,        // UPDATED: imports UsersModule (readonly)
    ShippingModule,
    TaxModule,
    // ... others
  ]
})
export class AppModule {}
```

```typescript
// users.module.ts
@Module({
  imports: [PrismaModule],
  providers: [UsersService, UsersRepository],
  controllers: [UsersController],
  exports: [UsersService],  // Exported for consumption
})
export class UsersModule {}
```

```typescript
// orders.module.ts
@Module({
  imports: [
    PrismaModule,
    UsersModule,        // NEW: imports for address resolution
    PaymentsModule,
    ShippingModule,
    TaxModule,
    // ...
  ],
  providers: [OrdersService, OrderRepository, CreateOrderUseCase],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
```

---

# Phase 4: Module & Folder Structure

## 4.1 Proposed Structure

```
src/users/                                    # NEW MODULE
├── users.module.ts                           # Module definition
├── users.controller.ts                       # REST endpoints
│
├── domain/
│   ├── user.entity.ts                       # User aggregate root
│   ├── shipping-address.entity.ts            # Shipping address entity
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
│   │   ├── set-default-payment-method.usecase.ts
│   │   └── get-user-profile.usecase.ts
│   │
│   └── dto/
│       ├── create-address.dto.ts
│       ├── update-address.dto.ts
│       ├── add-payment-method.dto.ts
│       ├── user-address-response.dto.ts
│       ├── user-payment-method-response.dto.ts
│       └── user-profile-response.dto.ts
│
├── infrastructure/
│   ├── user.repository.prisma.ts             # Prisma implementation
│   ├── payment-provider.adapter.ts           # PSP integration
│   └── repositories/
│       ├── shipping-address.repository.ts
│       └── payment-method.repository.ts
│
├── guards/
│   └── address-owner.guard.ts                # Only user owns their addresses
│
└── __tests__/
    ├── users.service.spec.ts
    ├── users.controller.spec.ts
    ├── domain/
    │   ├── shipping-address.entity.spec.ts
    │   └── payment-method.entity.spec.ts
    └── integration/
        ├── create-address.integration.spec.ts
        └── add-payment-method.integration.spec.ts
```

## 4.2 Detailed File Contents

### Domain Layer

#### `shipping-address.entity.ts`

```typescript
export class ShippingAddress {
  id: string
  userId: number
  label?: string
  fullName: string
  streetLine1: string
  streetLine2?: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  phoneNumber?: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  static create(dto: CreateAddressDto, userId: number): ShippingAddress {
    // Validation
    if (!dto.fullName?.trim()) throw new InvalidAddressError('fullName required')
    if (!dto.country) throw new InvalidAddressError('country required')
    // ...
    
    return new ShippingAddress({
      id: generateId(),
      userId,
      fullName: dto.fullName,
      // ... map from DTO
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  update(dto: UpdateAddressDto): void {
    if (dto.fullName !== undefined) this.fullName = dto.fullName
    // ... other fields
    this.updatedAt = new Date()
  }

  softDelete(): void {
    this.isActive = false
    this.deletedAt = new Date()
  }

  setAsDefault(): void {
    this.isDefault = true
  }

  unsetAsDefault(): void {
    this.isDefault = false
  }
}
```

#### `payment-method.entity.ts`

```typescript
export class UserPaymentMethod {
  id: string
  userId: number
  provider: string          // 'stripe', 'midtrans', etc.
  providerTokenId: string   // External token (e.g., 'pm_1234...')
  type: string              // 'card', 'bank_transfer', etc.
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  label?: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  static create(dto: AddPaymentMethodDto, userId: number): UserPaymentMethod {
    // Validation
    if (!dto.provider) throw new InvalidPaymentMethodError('provider required')
    if (!dto.providerTokenId) throw new InvalidPaymentMethodError('token required')
    
    return new UserPaymentMethod({
      id: generateId(),
      userId,
      provider: dto.provider,
      providerTokenId: dto.providerTokenId,
      type: dto.type || 'card',
      brand: dto.brand,
      last4Digits: dto.last4Digits,
      expiryMonth: dto.expiryMonth,
      expiryYear: dto.expiryYear,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  softDelete(): void {
    this.isActive = false
    this.deletedAt = new Date()
  }

  setAsDefault(): void {
    this.isDefault = true
  }

  unsetAsDefault(): void {
    this.isDefault = false
  }

  canBeUsed(): boolean {
    if (!this.isActive) return false
    if (this.deletedAt) return false
    // Check expiry if known
    if (this.expiryMonth && this.expiryYear) {
      const expiry = new Date(this.expiryYear, this.expiryMonth - 1)
      if (new Date() > expiry) return false
    }
    return true
  }
}
```

#### `user.repository.ts` (Interface)

```typescript
export interface UserRepository {
  // Shipping Addresses
  createShippingAddress(address: ShippingAddress): Promise<ShippingAddress>
  getShippingAddress(userId: number, addressId: string): Promise<ShippingAddress | null>
  listShippingAddresses(userId: number, options?: ListOptions): Promise<ShippingAddress[]>
  updateShippingAddress(address: ShippingAddress): Promise<ShippingAddress>
  softDeleteShippingAddress(addressId: string): Promise<void>
  
  // Payment Methods
  createPaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod>
  getPaymentMethod(userId: number, methodId: string): Promise<UserPaymentMethod | null>
  listPaymentMethods(userId: number, active?: boolean): Promise<UserPaymentMethod[]>
  softDeletePaymentMethod(methodId: string): Promise<void>
  
  // Defaults
  getDefaultShippingAddress(userId: number): Promise<ShippingAddress | null>
  getDefaultPaymentMethod(userId: number): Promise<UserPaymentMethod | null>
}
```

### Application Layer

#### `create-shipping-address.usecase.ts`

```typescript
@Injectable()
export class CreateShippingAddressUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(userId: number, dto: CreateAddressDto): Promise<ShippingAddressResponseDto> {
    // 1. Validate
    if (!dto.country) throw new BadRequestException('country required')
    
    // 2. Create entity
    const address = ShippingAddress.create(dto, userId)
    
    // 3. If first address, make it default
    const existingAddresses = await this.userRepository.listShippingAddresses(userId)
    if (existingAddresses.length === 0) {
      address.setAsDefault()
    }
    
    // 4. Persist
    const saved = await this.userRepository.createShippingAddress(address)
    
    // 5. Return DTO
    return ShippingAddressResponseDto.from(saved)
  }
}
```

#### `add-payment-method.usecase.ts`

```typescript
@Injectable()
export class AddPaymentMethodUseCase {
  constructor(
    private userRepository: UserRepository,
    private paymentProviderAdapter: PaymentProviderAdapter,
  ) {}

  async execute(userId: number, dto: AddPaymentMethodDto): Promise<UserPaymentMethodResponseDto> {
    // 1. Validate token with provider
    const tokenInfo = await this.paymentProviderAdapter.validateToken(
      dto.provider,
      dto.providerTokenId
    )
    if (!tokenInfo.valid) {
      throw new BadRequestException('Invalid payment token')
    }
    
    // 2. Create entity
    const method = UserPaymentMethod.create({
      ...dto,
      ...tokenInfo.metadata,  // brand, last4, expiry, etc.
    }, userId)
    
    // 3. If first method, make it default
    const existingMethods = await this.userRepository.listPaymentMethods(userId)
    if (existingMethods.length === 0) {
      method.setAsDefault()
    }
    
    // 4. Persist (never store raw data)
    const saved = await this.userRepository.createPaymentMethod(method)
    
    // 5. Return masked DTO
    return UserPaymentMethodResponseDto.from(saved)
  }
}
```

### DTO Layer

#### `create-address.dto.ts`

```typescript
export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  fullName: string

  @IsString()
  streetLine1: string

  @IsOptional()
  @IsString()
  streetLine2?: string

  @IsString()
  city: string

  @IsString()
  stateProvince: string

  @IsString()
  postalCode: string

  @IsString()
  @Length(2, 2)
  country: string  // ISO 3166-1 alpha-2

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsString()
  label?: string
}
```

#### `user-payment-method-response.dto.ts`

```typescript
export class UserPaymentMethodResponseDto {
  id: string
  provider: string
  type: string
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  label?: string
  isDefault: boolean
  createdAt: Date

  static from(method: UserPaymentMethod): UserPaymentMethodResponseDto {
    return {
      id: method.id,
      provider: method.provider,
      type: method.type,
      brand: method.brand,
      last4Digits: method.last4Digits,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      label: method.label,
      isDefault: method.isDefault,
      createdAt: method.createdAt,
      // NOTE: providerTokenId is NEVER exposed
    }
  }
}
```

---

# Phase 5: API Design

## 5.1 User Shipping Addresses

### Endpoints

#### `GET /users/me/addresses`

**Get all user's shipping addresses**

```
Request:
  Headers:
    Authorization: Bearer <token>
  Query:
    ?active=true  (optional)

Response 200:
  [
    {
      id: "addr_xyz",
      label: "Home",
      fullName: "Jane Doe",
      streetLine1: "123 Main St",
      city: "New York",
      stateProvince: "NY",
      postalCode: "10001",
      country: "US",
      phoneNumber: "+1234567890",
      isDefault: true,
      createdAt: "2026-01-15T10:30:00Z"
    },
    ...
  ]

Response 401:
  { error: "Unauthorized" }
```

#### `POST /users/me/addresses`

**Create new shipping address**

```
Request:
  Headers:
    Authorization: Bearer <token>
    Content-Type: application/json
  Body:
    {
      fullName: "Jane Doe",
      streetLine1: "123 Main St",
      streetLine2?: "Apt 5B",
      city: "New York",
      stateProvince: "NY",
      postalCode: "10001",
      country: "US",
      phoneNumber?: "+1234567890",
      label?: "Home"
    }

Response 201:
  {
    id: "addr_new123",
    fullName: "Jane Doe",
    label: "Home",
    isDefault: false,  (first address becomes default)
    createdAt: "2026-01-19T15:45:00Z"
  }

Response 400:
  { error: "Validation error", details: {...} }

Response 401:
  { error: "Unauthorized" }
```

**Validation Rules:**
- `fullName`: Required, min 2 characters
- `country`: Required, ISO 3166-1 alpha-2 format
- `postalCode`: Format varies by country (validation library)
- `phoneNumber`: Optional, E.164 format if provided

#### `GET /users/me/addresses/:id`

**Get specific address (authorization checked)**

```
Response 200: { ...address }
Response 404: { error: "Address not found" }
Response 403: { error: "Forbidden" }  // trying to access someone else's
```

#### `PUT /users/me/addresses/:id`

**Update address**

```
Request:
  Body: { ...updated fields, any subset of CreateAddressDto }

Response 200: { ...updated address }

Constraints:
  - Can ONLY update own addresses
  - Cannot update address referenced in "active" orders
    (orders with status PENDING, CHECKOUT, PAID)
```

#### `DELETE /users/me/addresses/:id`

**Soft-delete address**

```
Response 204: No content

Behavior:
  - Sets isActive=false, deletedAt=now()
  - If was default, moves default to first active address
  - Preserves data for audit trail
```

#### `PATCH /users/me/addresses/:id/default`

**Set as default address**

```
Response 200:
  {
    id: "addr_xyz",
    isDefault: true,
    ...
  }

Behavior:
  - Sets this address isDefault=true
  - Sets all other addresses isDefault=false
```

---

## 5.2 User Payment Methods

### Endpoints

#### `GET /users/me/payment-methods`

**Get all user's payment methods**

```
Request:
  Headers:
    Authorization: Bearer <token>
  Query:
    ?active=true  (optional)

Response 200:
  [
    {
      id: "pm_xyz",
      provider: "stripe",
      type: "card",
      brand: "visa",
      last4Digits: "4242",
      expiryMonth: 12,
      expiryYear: 2027,
      label: "My Visa",
      isDefault: true,
      createdAt: "2026-01-15T10:30:00Z"
    },
    ...
  ]

Note: providerTokenId is NEVER exposed
```

#### `POST /users/me/payment-methods`

**Add new payment method**

```
Request:
  Headers:
    Authorization: Bearer <token>
    Content-Type: application/json
  Body:
    {
      provider: "stripe",  // Must be registered provider
      providerTokenId: "pm_1234abc...",  // Token from Stripe/Midtrans/etc
      label?: "Backup Card"
    }

Response 201:
  {
    id: "pm_new123",
    provider: "stripe",
    type: "card",
    brand: "visa",
    last4Digits: "4242",
    expiryMonth: 12,
    expiryYear: 2027,
    isDefault: false,  (first method becomes default)
    createdAt: "2026-01-19T15:50:00Z"
  }

Response 400:
  { error: "Invalid payment token", details: "Token not found in Stripe" }

Validation:
  - provider: Must be one of registered providers
  - providerTokenId: Must be valid with provider (verified on add)
```

**Flow (Recommended Frontend Integration):**

```javascript
// Frontend (Next.js example)

// 1. User enters card details in Stripe widget
// 2. Frontend calls Stripe to tokenize (never see raw card)
const { setupIntent } = await stripe.confirmSetup({
  elements,
  confirmParams: { return_url: "..." },
})
const token = setupIntent.payment_method

// 3. Frontend calls backend with token
POST /users/me/payment-methods
{
  provider: "stripe",
  providerTokenId: token,  // e.g., "pm_1234..."
  label: "My Card"
}

// 4. Backend verifies token and stores reference only
```

#### `GET /users/me/payment-methods/:id`

**Get specific payment method**

```
Response 200: { ...masked payment method }
Response 404: { error: "Payment method not found" }
Response 403: { error: "Forbidden" }
```

#### `DELETE /users/me/payment-methods/:id`

**Remove payment method (soft delete)**

```
Response 204: No content

Behavior:
  - Sets isActive=false, deletedAt=now()
  - Cannot be reactivated
  - Cannot be used for new payments
  - If was default, moves default to first active method
```

#### `PATCH /users/me/payment-methods/:id/default`

**Set as default payment method**

```
Response 200:
  {
    id: "pm_xyz",
    isDefault: true,
    ...
  }

Behavior:
  - Sets this method isDefault=true
  - Sets all other methods isDefault=false
```

---

## 5.3 Integration with Orders/Checkout

### Updated Checkout Endpoint

```
POST /api/orders/checkout

Request:
  {
    cartId: 1,
    currency: "USD",
    
    // Option A (NEW): Use saved address
    shippingAddressId: "addr_xyz",
    
    // Option B (Existing): Provide inline
    shippingAddress: { fullName: "...", ... },
    
    shippingMethodId: "ship_123",
    discountCodes?: ["SAVE10"],
  }

Response:
  {
    id: "order_abc",
    currency: "USD",
    items: [...],
    subtotal: 10000,  // cents
    taxCents: 850,
    shippingCents: 500,
    finalTotalAmountCents: 11350,
    // ... rest of order
  }

Behavior:
  - If shippingAddressId provided, resolve from Users service
  - Create immutable ShippingAddress snapshot
  - Proceed with checkout as normal
```

### Updated Payment Endpoint

```
POST /api/orders/:id/payment

Request:
  {
    provider: "stripe",
    
    // Option A (NEW): Use saved payment method
    paymentMethodId: "pm_xyz",
    
    // Option B (Existing): Customer pays inline
    // (no paymentMethodId = use inline payment form)
  }

Response:
  {
    clientSecret: "pi_1234_secret",  // or provider's equivalent
    // ... payment intent details
  }

Behavior:
  - If paymentMethodId provided, resolve from Users service
  - Retrieve provider token
  - Create payment with provider using token
  - If successful, charge is completed
```

---

# Phase 6: Feature Flags & Rollout

## 6.1 Feature Flag Implementation

### Enum Update

```typescript
// src/feature-flags/feature-flags.service.ts

export enum FeatureFlag {
  // Architecture Refactoring Flags (Phase 0-4)
  ORDERS_CLEAN_ARCHITECTURE = 'orders_clean_architecture',
  TAX_SERVICE_LAYER = 'tax_service_layer',
  SHIPPING_SERVICE_LAYER = 'shipping_service_layer',
  INVENTORY_RESERVATION_V2 = 'inventory_reservation_v2',
  
  // NEW: User Management Features (Phase 8+)
  USER_SHIPPING_ADDRESS = 'user_shipping_address',
  USER_PAYMENT_METHOD = 'user_payment_method',
  USER_SAVED_ADDRESSES_AT_CHECKOUT = 'user_saved_addresses_at_checkout',
  
  // Existing payment/analytics flags
  PAYMENT_STRIPE_V2 = 'payment_stripe_v2',
  ANALYTICS_REALTIME = 'analytics_realtime',
}
```

### Environment Configuration

```bash
# .env

# Development (all on)
FEATURE_USER_SHIPPING_ADDRESS=true
FEATURE_USER_PAYMENT_METHOD=true
FEATURE_USER_SAVED_ADDRESSES_AT_CHECKOUT=true

# Staging (gradual rollout)
FEATURE_USER_SHIPPING_ADDRESS=true
FEATURE_USER_PAYMENT_METHOD=false
FEATURE_USER_SAVED_ADDRESSES_AT_CHECKOUT=false

# Production (off by default)
FEATURE_USER_SHIPPING_ADDRESS=false
FEATURE_USER_PAYMENT_METHOD=false
FEATURE_USER_SAVED_ADDRESSES_AT_CHECKOUT=false
```

### Guarded Endpoints

```typescript
// src/users/guards/feature-user-addresses.guard.ts

@Injectable()
export class FeatureUserAddressesGuard implements CanActivate {
  constructor(private featureFlags: FeatureFlagsService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.featureFlags.isEnabled(FeatureFlag.USER_SHIPPING_ADDRESS)) {
      throw new ForbiddenException('Feature not enabled')
    }
    return true
  }
}

// In controller
@UseGuards(JwtAuthGuard, FeatureUserAddressesGuard)
@Get('me/addresses')
async listAddresses(@Request() req) { ... }
```

### Rollout Strategy

**Week 1-2: Development/Internal Testing**
```
FEATURE_USER_SHIPPING_ADDRESS=true
FEATURE_USER_PAYMENT_METHOD=true
- Internal team creates addresses/payment methods
- Full testing in dev environment
```

**Week 3: Staging (Beta)**
```
FEATURE_USER_SHIPPING_ADDRESS=true
FEATURE_USER_PAYMENT_METHOD=false  (still testing)
- Beta users can create addresses
- Existing checkout with inline addresses still works
- Payment methods not yet exposed
```

**Week 4-5: Production (Limited Rollout)**
```
FEATURE_USER_SHIPPING_ADDRESS=true
FEATURE_USER_SAVED_ADDRESSES_AT_CHECKOUT=true
FEATURE_USER_PAYMENT_METHOD=false  (holding back)
- 50% of users see saved address option at checkout
- Default still off (inline addresses still work)
- Monitor for issues
```

**Week 6: Full Production**
```
All flags enabled
- 100% rollout
- Existing checkout gracefully falls back to inline
```

---

# Phase 7: Documentation

## 7.1 User-Facing API Docs

**Location**: `docs/features/user-addresses.md` and `docs/features/user-payment-methods.md`

### Quick Start

```markdown
## User Shipping Addresses

Save multiple shipping addresses for faster checkout.

### Getting Started

1. **Create an address:**
   ```bash
   POST /users/me/addresses
   Authorization: Bearer <token>
   
   {
     "fullName": "Jane Doe",
     "streetLine1": "123 Main St",
     "city": "New York",
     "stateProvince": "NY",
     "postalCode": "10001",
     "country": "US"
   }
   ```

2. **Use in checkout:**
   ```bash
   POST /api/orders/checkout
   {
     "cartId": 1,
     "shippingAddressId": "addr_xyz",  // Use saved address
     "shippingMethodId": "ship_123"
   }
   ```

### API Reference

See [REST Endpoints](#rest-endpoints) above.
```

---

# Phase 8: Migration & Compatibility

## 8.1 Backward Compatibility

### Scenario: Existing User Starts Using Saved Addresses

```
User Flow:
1. User logs in (existing JWT still works)
2. User navigates to "My Addresses" (NEW endpoint, feature-flagged)
3. User creates address
4. User goes to checkout
5. Checkout page shows "Use saved address" dropdown (NEW)
6. User selects saved address
7. Order created with snapshot of saved address
8. Existing orders unaffected

No Breaking Changes:
✅ Existing JWT tokens still valid
✅ Existing cart still works
✅ Existing checkout (inline addresses) still works
✅ Orders table unchanged (ShippingAddress snapshot still created)
✅ Existing orders not retroactively modified
```

### Scenario: User Never Creates Saved Addresses

```
User Flow:
1. User adds items to cart (existing)
2. User clicks checkout (existing)
3. User enters address inline (existing)
4. User selects shipping method (existing)
5. User proceeds to payment (existing)
6. Order created (existing)

Changes:
❌ ZERO user-visible changes
✅ If feature flag OFF, saved address endpoints 404
✅ Checkout endpoint ignores shippingAddressId (still accepts inline)
```

## 8.2 Data Migration Strategy

### Initial State (Day 0)

```sql
-- Users service is read-only initially
-- No existing user addresses (only order snapshots)
-- No existing saved payment methods

SELECT COUNT(*) FROM "User" WHERE id > 0;  -- e.g., 15,000 users
SELECT COUNT(*) FROM "ShippingAddress" WHERE "orderId" IS NOT NULL;  -- e.g., 45,000 (3 orders each)
SELECT COUNT(*) FROM "Payment" WHERE provider IS NOT NULL;  -- e.g., 45,000
```

### Migration (Day 1-N)

```typescript
// Prisma migration creates new tables
// src/users/infrastructure/migrations/

// CREATE TABLE "UserShippingAddress"
// CREATE TABLE "UserPaymentMethod"

// No backfill required
// - Existing orders keep ShippingAddress snapshot
// - Users can start creating new addresses
// - Old orders unaffected
```

### Verification

```sql
-- Day 1+
SELECT COUNT(*) FROM "UserShippingAddress";  -- Should be 0 initially
SELECT COUNT(*) FROM "UserPaymentMethod";    -- Should be 0 initially

-- As users create:
SELECT COUNT(*) FROM "UserShippingAddress" WHERE "createdAt" > NOW() - INTERVAL '1 day';
SELECT COUNT(*) FROM "UserPaymentMethod" WHERE "createdAt" > NOW() - INTERVAL '1 day';
```

---

# Implementation Timeline

## Phase 8: Implementation (4-6 weeks)

### Week 1: Foundation
- ✅ Create `UsersModule` with clean structure
- ✅ Create `ShippingAddress` & `PaymentMethod` entities
- ✅ Implement repository layer
- ✅ Add Prisma migrations

**Deliverables:**
- New database tables
- Domain layer complete
- Tests passing

### Week 2: Application Layer
- ✅ Implement use cases (create, update, delete, default)
- ✅ Create DTOs and validators
- ✅ Implement feature flags

**Deliverables:**
- Full CRUD functionality
- Unit tests passing
- Feature flags wired

### Week 3: API & Integration
- ✅ Create `UsersController` endpoints
- ✅ Update `OrdersService` to resolve saved addresses
- ✅ Update `PaymentsService` to support payment methods

**Deliverables:**
- REST endpoints working
- Orders integration tested
- Payments integration tested

### Week 4: Security & Tests
- ✅ Implement authorization guards
- ✅ Add comprehensive integration tests
- ✅ Load testing (100+ addresses per user)

**Deliverables:**
- Security audited
- Integration tests passing
- Performance baseline

### Week 5: Documentation & Staging
- ✅ Complete API documentation
- ✅ Deploy to staging
- ✅ Beta testing with internal users

**Deliverables:**
- Full documentation
- Staging environment ready
- Feedback gathered

### Week 6: Production Rollout
- ✅ Enable flags progressively
- ✅ Monitor metrics
- ✅ Handle support tickets

**Deliverables:**
- Features live for 100% of users
- Monitoring in place
- Documentation updated

---

## Success Criteria (Final Validation)

### Functional Requirements
- ✅ User can create/read/update/delete shipping addresses
- ✅ User can save/delete/list payment methods
- ✅ Default address/payment method enforced
- ✅ Addresses can be used in checkout
- ✅ Payment methods can be used for charging
- ✅ Orders snapshot address correctly

### Non-Functional Requirements
- ✅ No new circular dependencies (dependency tree verified)
- ✅ No breaking changes to existing endpoints
- ✅ Existing checkout works without saved addresses
- ✅ Feature flags working correctly
- ✅ Performance: address list < 100ms, payment list < 100ms
- ✅ Security: users can only access their own data
- ✅ No raw card data stored anywhere

### Testing
- ✅ Unit test coverage > 85%
- ✅ Integration test coverage > 75%
- ✅ Load test: 1000 addresses per user
- ✅ Authorization tests: verify ownership enforcement

---

## References & Dependencies

### Related Documentation
- [PHASE_4_ARCHITECTURE.md](../PHASE_4_ARCHITECTURE.md) — Extensibility patterns
- [CURRENT_STATE_ANALYSIS.md](../architecture/CURRENT_STATE_ANALYSIS.md) — Existing architecture
- [DISCOUNT_RULES_API.md](../DISCOUNT_RULES_API.md) — Similar pattern for domain modeling

### External References
- [Stripe Payment Methods API](https://stripe.com/docs/payments/save-payment-methods)
- [Midtrans Token Storage](https://docs.midtrans.com/reference/card-token)
- [Clean Architecture in NestJS](https://docs.nestjs.com/techniques/database)

---

## Appendix: Common Questions

### Q: Why create UserShippingAddress separately from ShippingAddress?

**A:** Separation of concerns:
- `ShippingAddress` = Immutable snapshot at order time (audit, never changes)
- `UserShippingAddress` = Mutable, user-managed for future orders
- Orders reference immutable copy, not live user data
- Allows users to change address for future orders without affecting existing

### Q: Can users have unlimited addresses?

**A:** Yes, by design. Recommend frontend limits:
- UI: Show max 50 in dropdown
- API: Accept all but paginate responses
- Database: No artificial limits

### Q: What happens if user deletes address used in active order?

**A:** Soft-delete only:
- Address marked `isActive=false`
- Cannot delete if referenced in PENDING/CHECKOUT/PAID orders
- Application layer enforces before delete

### Q: How do saved payment methods work across multiple providers?

**A:** Each provider manages its own tokens:
```
Stripe provider:
  - Manages Stripe tokens (pm_1234...)
  - User can have multiple Stripe methods
  - Each stored with provider='stripe'

Midtrans provider:
  - Manages Midtrans tokens
  - Separate from Stripe
  - Can mix both in same account
```

### Q: Is there PCI compliance risk?

**A:** No:
- No raw card data stored in our database
- All tokens from PSP (Stripe, Midtrans, etc.)
- PSP handles PCI compliance
- We only store references + masked metadata
- Safe for any compliance audit

---

**Document Version**: 1.0  
**Last Updated**: January 19, 2026  
**Status**: ✅ Ready for Implementation
