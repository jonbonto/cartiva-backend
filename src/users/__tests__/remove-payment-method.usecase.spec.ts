import { Test } from '@nestjs/testing'
import { RemovePaymentMethodUseCase } from '../application/use-cases/remove-payment-method.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('RemovePaymentMethodUseCase', () => {
  let usecase: RemovePaymentMethodUseCase
  let repo: any

  beforeEach(async () => {
    repo = {
      getPaymentMethod: jest.fn(),
      softDeletePaymentMethod: jest.fn(),
      listPaymentMethods: jest.fn(),
      updatePaymentMethod: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [RemovePaymentMethodUseCase, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile()

    usecase = module.get(RemovePaymentMethodUseCase)
  })

  it('throws when method not found', async () => {
    repo.getPaymentMethod.mockResolvedValue(null)
    await expect(usecase.execute(1, 'm1')).rejects.toThrow()
  })

  it('removes and reassigns default', async () => {
    const method = { id: 'm1', isDefault: true }
    repo.getPaymentMethod.mockResolvedValue(method)
    repo.listPaymentMethods.mockResolvedValue([{ id: 'm2', setAsDefault: jest.fn() }])

    await expect(usecase.execute(1, 'm1')).resolves.toBeUndefined()
    expect(repo.softDeletePaymentMethod).toHaveBeenCalledWith('m1')
    expect(repo.updatePaymentMethod).toHaveBeenCalled()
  })
})
