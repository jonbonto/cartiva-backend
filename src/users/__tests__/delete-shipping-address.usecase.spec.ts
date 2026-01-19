import { Test } from '@nestjs/testing'
import { DeleteShippingAddressUseCase } from '../application/use-cases/delete-shipping-address.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('DeleteShippingAddressUseCase', () => {
  let usecase: DeleteShippingAddressUseCase
  let repo: any

  beforeEach(async () => {
    repo = {
      getShippingAddress: jest.fn(),
      isAddressInUse: jest.fn(),
      softDeleteShippingAddress: jest.fn(),
      listShippingAddresses: jest.fn(),
      updateShippingAddress: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [DeleteShippingAddressUseCase, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile()

    usecase = module.get(DeleteShippingAddressUseCase)
  })

  it('throws when address not found', async () => {
    repo.getShippingAddress.mockResolvedValue(null)
    await expect(usecase.execute(1, 'a1')).rejects.toThrow()
  })

  it('throws when address in use', async () => {
    repo.getShippingAddress.mockResolvedValue({ id: 'a1', isDefault: false })
    repo.isAddressInUse.mockResolvedValue(true)
    await expect(usecase.execute(1, 'a1')).rejects.toThrow()
  })

  it('soft deletes and reassigns default when needed', async () => {
    const addr = { id: 'a1', isDefault: true }
    repo.getShippingAddress.mockResolvedValue(addr)
    repo.isAddressInUse.mockResolvedValue(false)
    repo.listShippingAddresses.mockResolvedValue([{ id: 'a2', setAsDefault: jest.fn() }])

    await expect(usecase.execute(1, 'a1')).resolves.toBeUndefined()
    expect(repo.softDeleteShippingAddress).toHaveBeenCalledWith('a1')
    expect(repo.updateShippingAddress).toHaveBeenCalled()
  })
})
