import { Test } from '@nestjs/testing'
import { CreateShippingAddressUseCase } from '../application/use-cases/create-shipping-address.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('CreateShippingAddressUseCase', () => {
  let usecase: CreateShippingAddressUseCase
  let repo: any

  beforeEach(async () => {
    repo = {
      listShippingAddresses: jest.fn(),
      createShippingAddress: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [CreateShippingAddressUseCase, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile()

    usecase = module.get(CreateShippingAddressUseCase)
  })

  it('throws when country missing', async () => {
    await expect(usecase.execute(1, { country: '' } as any)).rejects.toThrow()
  })

  it('sets default when first address', async () => {
    repo.listShippingAddresses.mockResolvedValue([])
    repo.createShippingAddress.mockImplementation((a) => Promise.resolve(a))

    const dto = {
      fullName: 'Jane Doe',
      streetLine1: '1',
      city: 'Town',
      stateProvince: 'ST',
      postalCode: '12345',
      country: 'US',
    }
    const res = await usecase.execute(2, dto as any)
    expect(res.userId).toBe(2)
    expect(res.isDefault).toBe(true)
    expect(repo.createShippingAddress).toHaveBeenCalled()
  })
})
