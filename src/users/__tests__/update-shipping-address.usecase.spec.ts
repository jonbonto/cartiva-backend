import { Test } from '@nestjs/testing'
import { UpdateShippingAddressUseCase } from '../application/use-cases/update-shipping-address.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('UpdateShippingAddressUseCase', () => {
  let usecase: UpdateShippingAddressUseCase
  let repo: any

  beforeEach(async () => {
    repo = {
      getShippingAddress: jest.fn(),
      updateShippingAddress: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [UpdateShippingAddressUseCase, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile()

    usecase = module.get(UpdateShippingAddressUseCase)
  })

  it('throws when address not found', async () => {
    repo.getShippingAddress.mockResolvedValue(null)
    await expect(usecase.execute(1, 'a1', {} as any)).rejects.toThrow()
  })

  it('updates when found', async () => {
    const address = { id: 'a1', userId: 1, update: jest.fn(), toJSON: () => ({}) }
    repo.getShippingAddress.mockResolvedValue(address)
    repo.updateShippingAddress.mockResolvedValue(address)

    const res = await usecase.execute(1, 'a1', { streetLine1: 'new' } as any)
    expect(address.update).toHaveBeenCalled()
    expect(repo.updateShippingAddress).toHaveBeenCalledWith(address)
    expect(res).toBe(address)
  })
})
