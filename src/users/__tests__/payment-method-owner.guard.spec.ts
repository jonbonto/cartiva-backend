import { Test } from '@nestjs/testing'
import { PaymentMethodOwnerGuard } from '../guards/payment-method-owner.guard'
import { USER_REPOSITORY } from '../domain/user.repository'
import { ForbiddenException, BadRequestException } from '@nestjs/common'

describe('PaymentMethodOwnerGuard', () => {
  let guard: PaymentMethodOwnerGuard
  let repo: any

  beforeEach(async () => {
    repo = {
      getPaymentMethod: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        PaymentMethodOwnerGuard,
        { provide: USER_REPOSITORY, useValue: repo },
      ],
    }).compile()

    guard = module.get(PaymentMethodOwnerGuard)
  })

  function makeContext(methodId?: string, userId?: number) {
    return ({
      switchToHttp: () => ({
        getRequest: () => ({ params: { methodId }, user: { id: userId } }),
      }),
    } as any)
  }

  it('allows when user owns the payment method', async () => {
    const method = { id: 'm1', userId: 10 }
    repo.getPaymentMethod.mockResolvedValue(method)

    const ctx = makeContext('m1', 10)
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true)
  })

  it('throws ForbiddenException when user does not own the method', async () => {
    const method = { id: 'm2', userId: 20 }
    repo.getPaymentMethod.mockResolvedValue(method)

    const ctx = makeContext('m2', 10)
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(ForbiddenException)
  })

  it('throws BadRequestException when methodId missing', async () => {
    const ctx = makeContext(undefined, 10)
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(BadRequestException)
  })
})
