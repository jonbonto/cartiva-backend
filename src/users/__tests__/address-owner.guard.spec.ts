import { AddressOwnerGuard } from '../guards/address-owner.guard'
import { USER_REPOSITORY } from '../domain/user.repository'
import { ExecutionContext } from '@nestjs/common'

describe('AddressOwnerGuard', () => {
  let guard: AddressOwnerGuard
  let repo: any

  beforeEach(() => {
    repo = {
      getShippingAddress: jest.fn(),
    }
    guard = new AddressOwnerGuard(repo)
  })

  function makeCtx(params: any, user: any): ExecutionContext {
    return ({
      switchToHttp: () => ({ getRequest: () => ({ params, user }) }),
    } as unknown) as ExecutionContext
  }

  it('throws when address id param missing', async () => {
    await expect(guard.canActivate(makeCtx({}, { id: 1 }))).rejects.toThrow()
  })

  it('throws when user not authenticated', async () => {
    await expect(guard.canActivate(makeCtx({ addressId: 'a1' }, {}))).rejects.toThrow()
  })

  it('throws when address not found', async () => {
    repo.getShippingAddress.mockResolvedValue(null)
    await expect(guard.canActivate(makeCtx({ addressId: 'a1' }, { id: 1 }))).rejects.toThrow()
  })

  it('allows when user owns address', async () => {
    repo.getShippingAddress.mockResolvedValue({ id: 'a1', userId: 1 })
    await expect(guard.canActivate(makeCtx({ addressId: 'a1' }, { id: 1 }))).resolves.toBe(true)
  })
})
