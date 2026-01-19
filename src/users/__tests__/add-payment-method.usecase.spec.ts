import { Test } from '@nestjs/testing'
import { AddPaymentMethodUseCase } from '../application/use-cases/add-payment-method.usecase'
import { USER_REPOSITORY } from '../domain/user.repository'
import { PAYMENT_TOKEN_VALIDATOR } from '../domain/payment-token.validator'

describe('AddPaymentMethodUseCase', () => {
  let usecase: AddPaymentMethodUseCase
  let repo: any
  let validator: any

  beforeEach(async () => {
    repo = {
      listPaymentMethods: jest.fn().mockResolvedValue([]),
      createPaymentMethod: jest.fn().mockImplementation((m) => Promise.resolve(m)),
    }
    validator = { validate: jest.fn().mockResolvedValue(true) }

    const module = await Test.createTestingModule({
      providers: [
        AddPaymentMethodUseCase,
        { provide: USER_REPOSITORY, useValue: repo },
        { provide: PAYMENT_TOKEN_VALIDATOR, useValue: validator },
      ],
    }).compile()

    usecase = module.get(AddPaymentMethodUseCase)
  })

  it('throws when provider or token missing', async () => {
    await expect(usecase.execute(1, { provider: '', providerTokenId: '' } as any)).rejects.toThrow()
  })

  it('throws when token invalid', async () => {
    validator.validate.mockResolvedValue(false)
    await expect(usecase.execute(1, { provider: 'stripe', providerTokenId: 'pm_x' } as any)).rejects.toThrow()
  })

  it('creates payment method and sets default when none exist', async () => {
    validator.validate.mockResolvedValue(true)
    repo.listPaymentMethods.mockResolvedValue([])

    const result = await usecase.execute(1, { provider: 'stripe', providerTokenId: 'pm_ok' } as any)
    expect(result.userId).toBe(1)
    expect(result.isDefault).toBe(true)
    expect(repo.createPaymentMethod).toHaveBeenCalled()
  })
})
