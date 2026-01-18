# Code Skeleton & Implementation Templates

Ready-to-implement code templates for Week 1-3 work.

---

## Phase 1: Domain Layer

### shipping-address.entity.ts

```typescript
// src/users/domain/shipping-address.entity.ts

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
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  constructor(data: Partial<ShippingAddress>) {
    Object.assign(this, data)
  }

  static create(dto: CreateAddressDto, userId: number): ShippingAddress {
    // Validate required fields
    if (!dto.fullName?.trim()) {
      throw new Error('fullName is required')
    }
    if (!dto.country) {
      throw new Error('country is required')
    }

    return new ShippingAddress({
      id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      fullName: dto.fullName.trim(),
      label: dto.label?.trim(),
      streetLine1: dto.streetLine1.trim(),
      streetLine2: dto.streetLine2?.trim(),
      city: dto.city.trim(),
      stateProvince: dto.stateProvince.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country.toUpperCase(),
      phoneNumber: dto.phoneNumber?.trim(),
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

  isDeleted(): boolean {
    return !this.isActive && this.deletedAt !== null
  }
}
```

### payment-method.entity.ts

```typescript
// src/users/domain/payment-method.entity.ts

export interface AddPaymentMethodDto {
  provider: string
  providerTokenId: string
  type?: string
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  cardholderName?: string
  label?: string
}

export class UserPaymentMethod {
  id: string
  userId: number
  provider: string
  providerTokenId: string // NEVER expose in API
  type: string
  brand?: string
  last4Digits?: string
  expiryMonth?: number
  expiryYear?: number
  cardholderName?: string
  label?: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  constructor(data: Partial<UserPaymentMethod>) {
    Object.assign(this, data)
  }

  static create(dto: AddPaymentMethodDto, userId: number): UserPaymentMethod {
    // Validate required fields
    if (!dto.provider) {
      throw new Error('provider is required')
    }
    if (!dto.providerTokenId) {
      throw new Error('providerTokenId is required')
    }

    return new UserPaymentMethod({
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      provider: dto.provider.toLowerCase(),
      providerTokenId: dto.providerTokenId,
      type: dto.type || 'card',
      brand: dto.brand,
      last4Digits: dto.last4Digits,
      expiryMonth: dto.expiryMonth,
      expiryYear: dto.expiryYear,
      cardholderName: dto.cardholderName,
      label: dto.label,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
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

  canBeUsed(): boolean {
    if (!this.isActive) return false
    if (this.deletedAt) return false
    
    // Check expiry if available
    if (this.expiryMonth && this.expiryYear) {
      const expiry = new Date(this.expiryYear, this.expiryMonth - 1)
      if (new Date() > expiry) return false
    }
    
    return true
  }
}
```

---

## Phase 1: Repository Interface

### user.repository.ts

```typescript
// src/users/domain/user.repository.ts

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
  
  // Check if address can be deleted (not in active order)
  isAddressInUse(addressId: string): Promise<boolean>

  // Payment Methods
  createPaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod>
  getPaymentMethod(userId: number, methodId: string): Promise<UserPaymentMethod | null>
  listPaymentMethods(userId: number): Promise<UserPaymentMethod[]>
  softDeletePaymentMethod(methodId: string): Promise<void>
  getDefaultPaymentMethod(userId: number): Promise<UserPaymentMethod | null>
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')
```

---

## Phase 2: Repository Implementation

### user.repository.prisma.ts (Partial)

```typescript
// src/users/infrastructure/user.repository.prisma.ts

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ShippingAddress } from '../domain/shipping-address.entity'
import { UserPaymentMethod } from '../domain/payment-method.entity'
import { UserRepository } from '../domain/user.repository'

@Injectable()
export class UserRepositoryPrisma implements UserRepository {
  constructor(private prisma: PrismaService) {}

  // --- SHIPPING ADDRESSES ---

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

  async isAddressInUse(addressId: string): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: {
        shippingAddress: {
          id: addressId,
        },
        status: {
          in: ['PENDING', 'CHECKOUT', 'PAID'],
        },
      },
    })

    return !!order
  }

  // --- PAYMENT METHODS --- (similar structure)

  async createPaymentMethod(method: UserPaymentMethod): Promise<UserPaymentMethod> {
    const created = await this.prisma.userPaymentMethod.create({
      data: {
        id: method.id,
        userId: method.userId,
        provider: method.provider,
        providerTokenId: method.providerTokenId,
        type: method.type,
        brand: method.brand,
        last4Digits: method.last4Digits,
        expiryMonth: method.expiryMonth,
        expiryYear: method.expiryYear,
        cardholderName: method.cardholderName,
        label: method.label,
        isDefault: method.isDefault,
        isActive: method.isActive,
      },
    })

    return new UserPaymentMethod(created)
  }

  // Implement remaining methods similarly...
}
```

---

## Phase 2: Use Cases

### create-shipping-address.usecase.ts

```typescript
// src/users/application/use-cases/create-shipping-address.usecase.ts

import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { CreateAddressDto } from '../dto/create-address.dto'
import { ShippingAddress } from '../../domain/shipping-address.entity'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class CreateShippingAddressUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: UserRepository,
  ) {}

  async execute(userId: number, dto: CreateAddressDto): Promise<ShippingAddress> {
    // 1. Validate input
    if (!dto.country) {
      throw new BadRequestException('country is required')
    }

    // 2. Create entity (domain logic validates)
    const address = ShippingAddress.create(dto, userId)

    // 3. Check if first address
    const existingAddresses = await this.userRepository.listShippingAddresses(userId)
    if (existingAddresses.length === 0) {
      address.setAsDefault()
    }

    // 4. Persist
    return await this.userRepository.createShippingAddress(address)
  }
}
```

### set-default-address.usecase.ts

```typescript
// src/users/application/use-cases/set-default-address.usecase.ts

import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class SetDefaultAddressUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: UserRepository,
  ) {}

  async execute(userId: number, addressId: string): Promise<void> {
    // 1. Get the address to set as default
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) {
      throw new BadRequestException('Address not found')
    }

    // 2. Get current default
    const currentDefault = await this.userRepository.getDefaultShippingAddress(userId)

    // 3. Unset old default
    if (currentDefault && currentDefault.id !== addressId) {
      currentDefault.unsetAsDefault()
      await this.userRepository.updateShippingAddress(currentDefault)
    }

    // 4. Set new default
    address.setAsDefault()
    await this.userRepository.updateShippingAddress(address)
  }
}
```

---

## Phase 3: DTOs

### create-address.dto.ts

```typescript
// src/users/application/dto/create-address.dto.ts

import { IsString, MinLength, IsOptional, Length } from 'class-validator'

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsString()
  @MinLength(2)
  fullName: string

  @IsString()
  @MinLength(2)
  streetLine1: string

  @IsOptional()
  @IsString()
  streetLine2?: string

  @IsString()
  @MinLength(2)
  city: string

  @IsString()
  @MinLength(2)
  stateProvince: string

  @IsString()
  @MinLength(2)
  postalCode: string

  @IsString()
  @Length(2, 2)  // ISO 3166-1 alpha-2
  country: string

  @IsOptional()
  @IsString()
  phoneNumber?: string
}
```

### shipping-address-response.dto.ts

```typescript
// src/users/application/dto/shipping-address-response.dto.ts

import { ShippingAddress } from '../../domain/shipping-address.entity'

export class ShippingAddressResponseDto {
  id: string
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
  createdAt: Date
  updatedAt: Date

  static from(address: ShippingAddress): ShippingAddressResponseDto {
    return {
      id: address.id,
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
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    }
  }
}
```

---

## Phase 3: Module & Controller

### users.module.ts

```typescript
// src/users/users.module.ts

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
import { AddPaymentMethodUseCase } from './application/use-cases/add-payment-method.usecase'
import { RemovePaymentMethodUseCase } from './application/use-cases/remove-payment-method.usecase'
import { SetDefaultPaymentMethodUseCase } from './application/use-cases/set-default-payment-method.usecase'

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
    AddPaymentMethodUseCase,
    RemovePaymentMethodUseCase,
    SetDefaultPaymentMethodUseCase,
  ],
  exports: [UsersService],
})
export class UsersModule {}
```

### users.service.ts

```typescript
// src/users/users.service.ts

import { Injectable, BadRequestException, ForbiddenException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from './domain/user.repository'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'
import { ShippingAddressResponseDto } from './application/dto/shipping-address-response.dto'
import { CreateShippingAddressUseCase } from './application/use-cases/create-shipping-address.usecase'
import { SetDefaultAddressUseCase } from './application/use-cases/set-default-address.usecase'

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: UserRepository,
    private createAddressUseCase: CreateShippingAddressUseCase,
    private setDefaultAddressUseCase: SetDefaultAddressUseCase,
  ) {}

  // --- SHIPPING ADDRESSES ---

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
    return ShippingAddressResponseDto.from(address)
  }

  async updateShippingAddress(
    userId: number,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<ShippingAddressResponseDto> {
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) {
      throw new BadRequestException('Address not found')
    }

    address.update(dto)
    const updated = await this.userRepository.updateShippingAddress(address)
    return ShippingAddressResponseDto.from(updated)
  }

  async deleteShippingAddress(userId: number, addressId: string): Promise<void> {
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) {
      throw new BadRequestException('Address not found')
    }

    // Check if in use
    const inUse = await this.userRepository.isAddressInUse(addressId)
    if (inUse) {
      throw new BadRequestException('Cannot delete address in active order')
    }

    await this.userRepository.softDeleteShippingAddress(addressId)

    // If was default, set new default
    if (address.isDefault) {
      const remaining = await this.userRepository.listShippingAddresses(userId)
      if (remaining.length > 0) {
        remaining[0].setAsDefault()
        await this.userRepository.updateShippingAddress(remaining[0])
      }
    }
  }

  async setDefaultAddress(userId: number, addressId: string): Promise<ShippingAddressResponseDto> {
    await this.setDefaultAddressUseCase.execute(userId, addressId)
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    return ShippingAddressResponseDto.from(address!)
  }

  // --- PAYMENT METHODS --- (similar structure)
}
```

### users.controller.ts (Partial)

```typescript
// src/users/users.controller.ts

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

  // --- SHIPPING ADDRESSES ---

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

  // --- PAYMENT METHODS --- (similar endpoints)
}
```

---

## Update to app.module.ts

```typescript
// src/app.module.ts

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'  // NEW
import { ProductsModule } from './products/products.module'
import { CartModule } from './cart/cart.module'
import { OrdersModule } from './orders/orders.module'
// ... other imports

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FeatureFlagsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,           // NEW
    ProductsModule,
    CartModule,
    OrdersModule,
    // ... other modules
  ],
})
export class AppModule {}
```

---

**Version**: 1.0  
**Status**: ✅ Ready to Implement  
**Next**: Copy templates to your codebase and customize as needed.
