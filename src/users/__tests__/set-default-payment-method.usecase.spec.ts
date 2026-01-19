import { Test } from '@nestjs/testing'
import { SetDefaultPaymentMethodUseCase } from '../application/use-cases/set-default-payment-method.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('SetDefaultPaymentMethodUseCase', () => {
  let usecase: SetDefaultPaymentMethodUseCase
  let repo: any

  beforeEach(async () => {
    repo = {
      getPaymentMethod: jest.fn(),
      getDefaultPaymentMethod: jest.fn(),
      updatePaymentMethod: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [SetDefaultPaymentMethodUseCase, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile()

    usecase = module.get(SetDefaultPaymentMethodUseCase)
  })

  it('throws when method not found', async () => {
    repo.getPaymentMethod.mockResolvedValue(null)
    await expect(usecase.execute(1, 'm1')).rejects.toThrow()
  })

  it('updates previous default and sets new default', async () => {
    const method = { id: 'm2', setAsDefault: jest.fn() }
    const prev = { id: 'm1', unsetAsDefault: jest.fn() }
    repo.getPaymentMethod.mockResolvedValue(method)
    repo.getDefaultPaymentMethod.mockResolvedValue(prev)

    await expect(usecase.execute(1, 'm2')).resolves.toBeUndefined()
    expect(prev.unsetAsDefault).toHaveBeenCalled()
    expect(repo.updatePaymentMethod).toHaveBeenCalled()
  })
})
