# Implementation Guide — Step-by-Step

**Estimated Duration**: 4-6 weeks  
**Start Date**: January 20, 2026  
**Target Release**: February 28, 2026

---

## Table of Contents

1. [Week 1: Database & Domain Layer](#week-1-database--domain-layer)
2. [Week 2: Repository & Application Layer](#week-2-repository--application-layer)
3. [Week 3: Controllers & API Integration](#week-3-controllers--api-integration)
4. [Week 4: Security & Tests](#week-4-security--tests)
5. [Week 5: Staging & Documentation](#week-5-staging--documentation)
6. [Week 6: Production Rollout](#week-6-production-rollout)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Checklist](#deployment-checklist)

---

## Week 1: Database & Domain Layer

### Tasks

#### 1.1 Create Prisma Migration

**File**: `prisma/migrations/20260119_add_user_addresses_and_payment_methods/migration.sql`

Follow schema from [DATABASE_SCHEMA_USER_MANAGEMENT.md](../DATABASE_SCHEMA_USER_MANAGEMENT.md)

```bash
# Command
npx prisma migrate dev --name add_user_addresses_and_payment_methods

# Verify
npx prisma db push --skip-generate
npx prisma generate
```

#### 1.2 Create Domain Entities

**Directory**: `src/users/domain/`

Files:
- `shipping-address.entity.ts`
- `payment-method.entity.ts`
- `user.entity.ts`
- `user-profile.aggregate.ts`
- `user.repository.ts` (interface)

**Example: shipping-address.entity.ts**

```typescript
export interface CreateAddressDto {
  label?: string
  fullName: string
  streetLine1: string
  streetLine2?: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  phoneNumber?: string
}

export interface UpdateAddressDto {
  label?: string
  fullName?: string
  streetLine1?: string
  streetLine2?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
  phoneNumber?: string
}

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
  isDefault: boolean = false
  isActive: boolean = true
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  constructor(data: Partial<ShippingAddress>) {
    Object.assign(this, data)
  }

  static create(dto: CreateAddressDto, userId: number): ShippingAddress {
    // Validate
    if (!dto.fullName?.trim()) {
      throw new Error('fullName is required')
    }
    if (!dto.country) {
      throw new Error('country is required')
    }

    return new ShippingAddress({
      id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      fullName: dto.fullName,
      label: dto.label,
      streetLine1: dto.streetLine1,
      streetLine2: dto.streetLine2,
      city: dto.city,
      stateProvince: dto.stateProvince,
      postalCode: dto.postalCode,
      country: dto.country,
      phoneNumber: dto.phoneNumber,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  update(dto: UpdateAddressDto): void {
    if (dto.fullName !== undefined) this.fullName = dto.fullName
    if (dto.label !== undefined) this.label = dto.label
    if (dto.streetLine1 !== undefined) this.streetLine1 = dto.streetLine1
    if (dto.streetLine2 !== undefined) this.streetLine2 = dto.streetLine2
    if (dto.city !== undefined) this.city = dto.city
    if (dto.stateProvince !== undefined) this.stateProvince = dto.stateProvince
    if (dto.postalCode !== undefined) this.postalCode = dto.postalCode
    if (dto.country !== undefined) this.country = dto.country
    if (dto.phoneNumber !== undefined) this.phoneNumber = dto.phoneNumber
    this.updatedAt = new Date()
  }

  setAsDefault(): void {
    this.isDefault = true
  }

  unsetAsDefault(): void {
    this.isDefault = false
  }

  softDelete(): void {
    this.isActive = false
    this.deletedAt = new Date()
  }
}
```

#### 1.3 Create Repository Interface

**File**: `src/users/domain/user.repository.ts`

```typescript
import { ShippingAddress } from './shipping-address.entity'
import { UserPaymentMethod } from './payment-method.entity'

export interface UserRepository {
  // Shipping Addresses
  createShippingAddress(address: ShippingAddress): Promise<ShippingAddress>
  getShippingAddress(userId: number, addressId: string): Promise<ShippingAddress | null>
  listShippingAddresses(userId: number): Promise<ShippingAddress[]>
  updateShippingAddress(address: ShippingAddress): Promise<ShippingAddress>
  softDeleteShippingAddress(addressId: string): Promise<void>
  getDefaultShippingAddress(userId: number): Promise<ShippingAddress | null>

  // Payment Methods
  createPaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod>
  getPaymentMethod(userId: number, methodId: string): Promise<UserPaymentMethod | null>
  listPaymentMethods(userId: number): Promise<UserPaymentMethod[]>
  softDeletePaymentMethod(methodId: string): Promise<void>
  getDefaultPaymentMethod(userId: number): Promise<UserPaymentMethod | null>
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')
```

#### 1.4 Verification

```bash
# Run migrations
npm run migrate:dev

# Generate Prisma types
npx prisma generate

# Verify types exist
grep -r "UserShippingAddress" node_modules/.prisma/client/
```

---

## Week 2: Repository & Application Layer

### Tasks

#### 2.1 Create Prisma Repository Implementation

**File**: `src/users/infrastructure/user.repository.prisma.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ShippingAddress } from '../domain/shipping-address.entity'
import { UserRepository, USER_REPOSITORY } from '../domain/user.repository'

@Injectable()
export class UserRepositoryPrisma implements UserRepository {
  constructor(private prisma: PrismaService) {}

  async createShippingAddress(address: ShippingAddress): Promise<ShippingAddress> {
    const created = await this.prisma.userShippingAddress.create({
      data: {
        id: address.id,
        userId: address.userId,
        label: address.label,
        fullName: address.fullName,
        streetLine1: address.streetLine1,
        streetLine2: address.streetLine2,
        city: address.city,
        stateProvince: address.stateProvince,
        postalCode: address.postalCode,
        country: address.country,
        phoneNumber: address.phoneNumber,
        isDefault: address.isDefault,
        isActive: address.isActive,
      },
    })

    return new ShippingAddress(created)
  }

  async getShippingAddress(userId: number, addressId: string): Promise<ShippingAddress | null> {
    const address = await this.prisma.userShippingAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
    })

    return address ? new ShippingAddress(address) : null
  }

  async listShippingAddresses(userId: number): Promise<ShippingAddress[]> {
    const addresses = await this.prisma.userShippingAddress.findMany({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })

    return addresses.map(addr => new ShippingAddress(addr))
  }

  async updateShippingAddress(address: ShippingAddress): Promise<ShippingAddress> {
    const updated = await this.prisma.userShippingAddress.update({
      where: { id: address.id },
      data: {
        label: address.label,
        fullName: address.fullName,
        streetLine1: address.streetLine1,
        streetLine2: address.streetLine2,
        city: address.city,
        stateProvince: address.stateProvince,
        postalCode: address.postalCode,
        country: address.country,
        phoneNumber: address.phoneNumber,
        isDefault: address.isDefault,
        updatedAt: address.updatedAt,
      },
    })

    return new ShippingAddress(updated)
  }

  async softDeleteShippingAddress(addressId: string): Promise<void> {
    await this.prisma.userShippingAddress.update({
      where: { id: addressId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    })
  }

  async getDefaultShippingAddress(userId: number): Promise<ShippingAddress | null> {
    const address = await this.prisma.userShippingAddress.findFirst({
      where: {
        userId,
        isDefault: true,
        isActive: true,
      },
    })

    return address ? new ShippingAddress(address) : null
  }

  // Similar implementations for PaymentMethod methods...
}
```

#### 2.2 Create Use Cases

**Directory**: `src/users/application/use-cases/`

Priority order:
1. `create-shipping-address.usecase.ts`
2. `update-shipping-address.usecase.ts`
3. `delete-shipping-address.usecase.ts`
4. `set-default-address.usecase.ts`
5. `add-payment-method.usecase.ts`
6. `remove-payment-method.usecase.ts`
7. `set-default-payment-method.usecase.ts`

**Example: create-shipping-address.usecase.ts**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common'
import { CreateAddressDto } from '../dto/create-address.dto'
import { ShippingAddress } from '../../domain/shipping-address.entity'
import { UserRepository } from '../../domain/user.repository'

@Injectable()
export class CreateShippingAddressUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(userId: number, dto: CreateAddressDto): Promise<ShippingAddress> {
    // Validate
    if (!dto.country) {
      throw new BadRequestException('country is required')
    }

    // Create entity
    const address = ShippingAddress.create(dto, userId)

    // Check if first address
    const existing = await this.userRepository.listShippingAddresses(userId)
    if (existing.length === 0) {
      address.setAsDefault()
    }

    // Persist
    return await this.userRepository.createShippingAddress(address)
  }
}
```

#### 2.3 Create DTOs

**Directory**: `src/users/application/dto/`

Files:
- `create-address.dto.ts`
- `update-address.dto.ts`
- `add-payment-method.dto.ts`
- `shipping-address-response.dto.ts`
- `payment-method-response.dto.ts`

#### 2.4 Create Module

**File**: `src/users/users.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UserRepositoryPrisma } from './infrastructure/user.repository.prisma'
import { USER_REPOSITORY } from './domain/user.repository'
import { PrismaModule } from '../prisma/prisma.module'

// Use cases
import { CreateShippingAddressUseCase } from './application/use-cases/create-shipping-address.usecase'
import { UpdateShippingAddressUseCase } from './application/use-cases/update-shipping-address.usecase'
import { DeleteShippingAddressUseCase } from './application/use-cases/delete-shipping-address.usecase'
import { SetDefaultAddressUseCase } from './application/use-cases/set-default-address.usecase'

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepositoryPrisma,
    },
    UsersService,
    CreateShippingAddressUseCase,
    UpdateShippingAddressUseCase,
    DeleteShippingAddressUseCase,
    SetDefaultAddressUseCase,
  ],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## Week 3: Controllers & API Integration

### Tasks

#### 3.1 Create Users Controller

**File**: `src/users/users.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt.guard'
import { UsersService } from './users.service'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'

@Controller('api/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Shipping Addresses

  @UseGuards(JwtAuthGuard)
  @Get('me/addresses')
  async listAddresses(@Request() req: any) {
    return this.usersService.listShippingAddresses(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/addresses')
  async createAddress(@Body() dto: CreateAddressDto, @Request() req: any) {
    return this.usersService.createShippingAddress(req.user.id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/addresses/:id')
  async getAddress(@Param('id') addressId: string, @Request() req: any) {
    return this.usersService.getShippingAddress(req.user.id, addressId)
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/addresses/:id')
  async updateAddress(
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
    @Request() req: any,
  ) {
    return this.usersService.updateShippingAddress(req.user.id, addressId, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/addresses/:id')
  @HttpCode(204)
  async deleteAddress(@Param('id') addressId: string, @Request() req: any) {
    return this.usersService.deleteShippingAddress(req.user.id, addressId)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/addresses/:id/default')
  async setDefaultAddress(@Param('id') addressId: string, @Request() req: any) {
    return this.usersService.setDefaultAddress(req.user.id, addressId)
  }

  // Payment Methods

  @UseGuards(JwtAuthGuard)
  @Get('me/payment-methods')
  async listPaymentMethods(@Request() req: any) {
    return this.usersService.listPaymentMethods(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/payment-methods')
  async addPaymentMethod(@Body() dto: any, @Request() req: any) {
    return this.usersService.addPaymentMethod(req.user.id, dto)
  }

  // Additional endpoints...
}
```

#### 3.2 Create Users Service

**File**: `src/users/users.service.ts`

```typescript
import { Injectable, BadRequestException, ForbiddenException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from './domain/user.repository'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'
import { CreateShippingAddressUseCase } from './application/use-cases/create-shipping-address.usecase'
import { ShippingAddressResponseDto } from './application/dto/shipping-address-response.dto'

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: UserRepository,
    private createAddressUseCase: CreateShippingAddressUseCase,
  ) {}

  async createShippingAddress(
    userId: number,
    dto: CreateAddressDto,
  ): Promise<ShippingAddressResponseDto> {
    const address = await this.createAddressUseCase.execute(userId, dto)
    return ShippingAddressResponseDto.from(address)
  }

  async listShippingAddresses(userId: number): Promise<ShippingAddressResponseDto[]> {
    const addresses = await this.userRepository.listShippingAddresses(userId)
    return addresses.map(ShippingAddressResponseDto.from)
  }

  async getShippingAddress(
    userId: number,
    addressId: string,
  ): Promise<ShippingAddressResponseDto> {
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) {
      throw new BadRequestException('Address not found')
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Unauthorized')
    }
    return ShippingAddressResponseDto.from(address)
  }

  // Additional methods...
}
```

#### 3.3 Update Orders Module

**File**: `src/orders/orders.service.ts` (modifications)

```typescript
// In OrdersService.createOrderFromCart()

async createOrderFromCart(
  cartId: number,
  userId: number,
  createOrderDto: CreateOrderDto,
): Promise<OrderType> {
  // ... existing code ...

  // UPDATED: Support both inline address and saved address reference
  let shippingAddressForSnapshot: any = null

  if (createOrderDto.shippingAddressId) {
    // NEW: Resolve from saved addresses
    const savedAddress = await this.usersService.getShippingAddressForSnapshot(
      userId,
      createOrderDto.shippingAddressId,
    )
    shippingAddressForSnapshot = savedAddress
  } else if (createOrderDto.shippingAddress) {
    // EXISTING: Use inline address
    shippingAddressForSnapshot = createOrderDto.shippingAddress
  }

  // Create snapshot (existing logic unchanged)
  // ...
}
```

#### 3.4 Verification

```bash
# Build modules
npm run build

# Test controller endpoints
npm run start:dev

# Try endpoint
curl -X GET http://localhost:3000/api/users/me/addresses \
  -H "Authorization: Bearer <token>"
```

---

## Week 4: Security & Tests

### Tasks

#### 4.1 Create Authorization Guard

**File**: `src/users/guards/address-owner.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { UserRepository, USER_REPOSITORY } from '../domain/user.repository'
import { Inject } from '@nestjs/common'

@Injectable()
export class AddressOwnerGuard implements CanActivate {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const { id: addressId } = request.params
    const userId = request.user?.id

    if (!userId) {
      throw new ForbiddenException('User not authenticated')
    }

    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address || address.userId !== userId) {
      throw new ForbiddenException('You do not own this address')
    }

    return true
  }
}
```

#### 4.2 Create Unit Tests

**File**: `src/users/__tests__/users.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing'
import { UsersService } from '../users.service'
import { USER_REPOSITORY } from '../domain/user.repository'
import { ShippingAddress } from '../domain/shipping-address.entity'
import { CreateShippingAddressUseCase } from '../application/use-cases/create-shipping-address.usecase'

describe('UsersService', () => {
  let service: UsersService
  let repository: any

  beforeEach(async () => {
    const mockRepository = {
      listShippingAddresses: jest.fn(),
      createShippingAddress: jest.fn(),
      getShippingAddress: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        CreateShippingAddressUseCase,
        {
          provide: USER_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    repository = module.get(USER_REPOSITORY)
  })

  describe('createShippingAddress', () => {
    it('should create address with first address as default', async () => {
      const userId = 123
      const dto = {
        fullName: 'Jane Doe',
        streetLine1: '123 Main St',
        city: 'New York',
        stateProvince: 'NY',
        postalCode: '10001',
        country: 'US',
      }

      repository.listShippingAddresses.mockResolvedValue([])
      repository.createShippingAddress.mockResolvedValue(
        new ShippingAddress({
          id: 'addr_1',
          userId,
          ...dto,
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      const result = await service.createShippingAddress(userId, dto)

      expect(result.isDefault).toBe(true)
      expect(repository.createShippingAddress).toHaveBeenCalled()
    })
  })

  describe('listShippingAddresses', () => {
    it('should return list of user addresses', async () => {
      const userId = 123
      const addresses = [
        new ShippingAddress({
          id: 'addr_1',
          userId,
          fullName: 'Jane',
          streetLine1: '123 Main',
          city: 'NY',
          stateProvince: 'NY',
          postalCode: '10001',
          country: 'US',
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]

      repository.listShippingAddresses.mockResolvedValue(addresses)

      const result = await service.listShippingAddresses(userId)

      expect(result).toHaveLength(1)
      expect(result[0].isDefault).toBe(true)
    })
  })
})
```

#### 4.3 Create Integration Tests

**File**: `src/users/__tests__/users.controller.integration.spec.ts`

```typescript
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../../app.module'

describe('Users Controller (Integration)', () => {
  let app: INestApplication
  let token: string
  let userId: number

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    // Register user
    const signupRes = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })

    token = signupRes.body.token
    userId = signupRes.body.user.id
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /users/me/addresses', () => {
    it('should create shipping address', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users/me/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Jane Doe',
          streetLine1: '123 Main St',
          city: 'New York',
          stateProvince: 'NY',
          postalCode: '10001',
          country: 'US',
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.isDefault).toBe(true)  // First address
      expect(res.body.fullName).toBe('Jane Doe')
    })
  })

  describe('GET /users/me/addresses', () => {
    it('should list user addresses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me/addresses')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
    })
  })
})
```

#### 4.4 Performance Tests

```bash
# Load test: 1000 addresses per user
npm run test:performance -- users.addresses
```

---

## Week 5: Staging & Documentation

### Tasks

#### 5.1 Deploy to Staging

```bash
# Build
npm run build

# Run migrations
npm run migrate:dev

# Start staging server
npm run start:prod -- --env=staging
```

#### 5.2 Test Scenarios

- [ ] Create 50 addresses (performance)
- [ ] Set default address (invariants)
- [ ] Update address in active order (forbidden)
- [ ] Delete non-existent address (404)
- [ ] Use saved address in checkout (integration)
- [ ] Authorization: Access someone else's address (403)

#### 5.3 Documentation

Update:
- [USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md](../USER_SHIPPING_ADDRESS_PAYMENT_METHOD.md)
- [API_REFERENCE.md](./API_REFERENCE.md) (if exists)
- [README.md](../../README.md)

---

## Week 6: Production Rollout

### Tasks

#### 6.1 Feature Flag Rollout

```env
# Day 1
FEATURE_USER_SHIPPING_ADDRESS=true
FEATURE_USER_PAYMENT_METHOD=false

# Day 7 (if no issues)
FEATURE_USER_SAVED_ADDRESSES_AT_CHECKOUT=true

# Day 14 (if no issues)
FEATURE_USER_PAYMENT_METHOD=true

# Day 21
All flags enabled globally
```

#### 6.2 Monitoring

Set up alerts:
- Error rate on `/users/me/addresses` endpoints
- Database query performance
- User signup/address creation correlation

#### 6.3 Documentation Updates

- [ ] Update README with new endpoints
- [ ] Create troubleshooting guide
- [ ] Document feature flags

---

## Testing Strategy

### Unit Tests

```
Target: 85%+ coverage

Test Suites:
- ShippingAddress entity (create, update, delete, setDefault)
- PaymentMethod entity (create, delete, setDefault)
- Use cases (each CRUD operation)
- DTOs (validation)
- Service layer (integration with repo)
```

### Integration Tests

```
Test Flows:
1. Create address → List → Set default
2. Create payment method → List → Remove
3. Checkout with saved address
4. Payment with saved method
5. Authorization (access own, not others)
```

### Load Tests

```
Scenarios:
- Create 1000 addresses per user
- List 1000 addresses (pagination)
- Set default among 500 addresses
- Payment provider token validation (mock 100 concurrent)
```

### Regression Tests

```
Verify:
- Existing checkout (without saved addresses) still works
- Existing payment flow unchanged
- No performance degradation
- All existing tests still pass
```

---

## Deployment Checklist

### Pre-Deployment (Production)

- [ ] All tests passing locally
- [ ] Staging environment tested (2 days)
- [ ] Feature flags configured (OFF by default)
- [ ] Database backups ready
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
- [ ] Support team trained
- [ ] Documentation published

### Deployment (Day 1)

- [ ] Deploy code to production
- [ ] Verify migrations run successfully
- [ ] Enable feature flag for internal testing (1 user)
- [ ] Monitor for 24 hours

### Gradual Rollout (Days 2-7)

- [ ] Day 2: Enable for 5% of users
- [ ] Day 3: Monitor, then 25%
- [ ] Day 4: Monitor, then 50%
- [ ] Day 5: Monitor, then 75%
- [ ] Day 6: Monitor, then 100%

### Post-Deployment

- [ ] All metrics normal
- [ ] No customer complaints
- [ ] Remove experimental code
- [ ] Update documentation with live endpoints

---

## Rollback Plan

### If Critical Issues Found

```bash
# Disable feature flag
FEATURE_USER_SHIPPING_ADDRESS=false
FEATURE_USER_PAYMENT_METHOD=false

# Verify checkout works
curl -X POST http://localhost:3000/api/orders/checkout \
  -H "Authorization: Bearer <token>" \
  -d '{ "cartId": 1, "shippingAddress": {...} }'

# If database corruption, revert migration
npx prisma migrate resolve --rolled-back 20260119_add_user_addresses_and_payment_methods
```

### Communication

- Notify support team immediately
- Post status update (if using public status page)
- Monitor existing orders to ensure no data loss
- Prepare post-mortem

---

**Version**: 1.0  
**Date**: January 19, 2026  
**Status**: Ready to Start Week 1
