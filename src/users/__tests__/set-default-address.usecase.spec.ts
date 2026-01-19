import { Test } from '@nestjs/testing'
import { SetDefaultAddressUseCase } from '../application/use-cases/set-default-address.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('SetDefaultAddressUseCase', () => {
  let usecase: SetDefaultAddressUseCase
  let repo: any

  beforeEach(async () => {
    repo = {
      getShippingAddress: jest.fn(),
      getDefaultShippingAddress: jest.fn(),
      updateShippingAddress: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [SetDefaultAddressUseCase, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile()

    usecase = module.get(SetDefaultAddressUseCase)
  })

  it('throws when not found', async () => {
    repo.getShippingAddress.mockResolvedValue(null)
    await expect(usecase.execute(1, 'a1')).rejects.toThrow()
  })

  it('updates previous default and sets new default', async () => {
    const addr = { id: 'a2', setAsDefault: jest.fn() }
    const prev = { id: 'a1', unsetAsDefault: jest.fn() }
    repo.getShippingAddress.mockResolvedValue(addr)
    repo.getDefaultShippingAddress.mockResolvedValue(prev)

    await expect(usecase.execute(1, 'a2')).resolves.toBeUndefined()
    expect(prev.unsetAsDefault).toHaveBeenCalled()
    expect(repo.updateShippingAddress).toHaveBeenCalled()
  })
})
