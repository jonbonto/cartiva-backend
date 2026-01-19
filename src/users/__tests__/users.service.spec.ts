import { Test } from '@nestjs/testing'
import { UsersService } from '../users.service'
import { USER_REPOSITORY } from '../domain/user.repository'
import { ShippingAddress } from '../domain/shipping-address.entity'
import { CreateShippingAddressUseCase } from '../application/use-cases/create-shipping-address.usecase'
import { UpdateShippingAddressUseCase } from '../application/use-cases/update-shipping-address.usecase'
import { DeleteShippingAddressUseCase } from '../application/use-cases/delete-shipping-address.usecase'
import { SetDefaultAddressUseCase } from '../application/use-cases/set-default-address.usecase'
import { AddPaymentMethodUseCase } from '../application/use-cases/add-payment-method.usecase'
import { RemovePaymentMethodUseCase } from '../application/use-cases/remove-payment-method.usecase'
import { SetDefaultPaymentMethodUseCase } from '../application/use-cases/set-default-payment-method.usecase'
import { PAYMENT_TOKEN_VALIDATOR } from '../domain/payment-token.validator'

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
        UpdateShippingAddressUseCase,
        DeleteShippingAddressUseCase,
        SetDefaultAddressUseCase,
        AddPaymentMethodUseCase,
        RemovePaymentMethodUseCase,
        SetDefaultPaymentMethodUseCase,
        {
          provide: USER_REPOSITORY,
          useValue: mockRepository,
        },
        {
          provide: PAYMENT_TOKEN_VALIDATOR,
          useValue: { validate: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    repository = module.get(USER_REPOSITORY)
  })

  describe('createAddress', () => {
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

      const result = await service.createAddress(userId, dto as any)

      expect(result.isDefault).toBe(true)
      expect(repository.createShippingAddress).toHaveBeenCalled()
    })
  })

  describe('listAddresses', () => {
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

      const result = await service.listAddresses(userId)

      expect(result).toHaveLength(1)
      expect(result[0].isDefault).toBe(true)
    })
  })
})
