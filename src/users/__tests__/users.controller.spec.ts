import { Test } from '@nestjs/testing'
import { UsersController } from '../users.controller'
import { UsersService } from '../users.service'
import { USER_REPOSITORY } from '../domain/user.repository'

describe('UsersController', () => {
  let controller: UsersController
  let service: any

  beforeEach(async () => {
    service = {
      createAddress: jest.fn(),
      listAddresses: jest.fn(),
      getAddress: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
      setDefaultAddress: jest.fn(),
      addPaymentMethod: jest.fn(),
      listPaymentMethods: jest.fn(),
      removePaymentMethod: jest.fn(),
      setDefaultPaymentMethod: jest.fn(),
    }

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: service },
        // Guards used by controller rely on USER_REPOSITORY - provide a noop mock so module compiles
        { provide: USER_REPOSITORY, useValue: {} },
      ],
    }).compile()

    controller = module.get(UsersController)
  })

  function reqWithUser(id: number) {
    return { user: { id } }
  }

  it('createAddress delegates to service', async () => {
    service.createAddress.mockResolvedValue({ id: 'a1' })
    const res = await controller.createAddress(reqWithUser(5) as any, { country: 'US' } as any)
    expect(res).toEqual({ id: 'a1' })
    expect(service.createAddress).toHaveBeenCalledWith(5, expect.any(Object))
  })

  it('listAddresses delegates', async () => {
    service.listAddresses.mockResolvedValue([])
    await controller.listAddresses(reqWithUser(5) as any)
    expect(service.listAddresses).toHaveBeenCalledWith(5)
  })

  it('updateAddress delegates', async () => {
    service.updateAddress.mockResolvedValue({})
    await controller.updateAddress(reqWithUser(7) as any, 'a1', { streetLine1: 'x' } as any)
    expect(service.updateAddress).toHaveBeenCalledWith(7, 'a1', expect.any(Object))
  })

  it('deleteAddress delegates', async () => {
    service.deleteAddress.mockResolvedValue({})
    await controller.deleteAddress(reqWithUser(7) as any, 'a1')
    expect(service.deleteAddress).toHaveBeenCalledWith(7, 'a1')
  })

  it('setDefaultAddress delegates', async () => {
    service.setDefaultAddress.mockResolvedValue({})
    await controller.setDefaultAddress(reqWithUser(7) as any, 'a1')
    expect(service.setDefaultAddress).toHaveBeenCalledWith(7, 'a1')
  })

  it('addPaymentMethod delegates', async () => {
    service.addPaymentMethod.mockResolvedValue({ id: 'm1' })
    await controller.addPaymentMethod(reqWithUser(8) as any, { provider: 'stripe', providerTokenId: 'pm' } as any)
    expect(service.addPaymentMethod).toHaveBeenCalledWith(8, expect.any(Object))
  })

  it('listPaymentMethods delegates', async () => {
    service.listPaymentMethods.mockResolvedValue([])
    await controller.listPaymentMethods(reqWithUser(9) as any)
    expect(service.listPaymentMethods).toHaveBeenCalledWith(9)
  })

  it('removePaymentMethod delegates', async () => {
    service.removePaymentMethod.mockResolvedValue({})
    await controller.removePaymentMethod(reqWithUser(9) as any, 'm1')
    expect(service.removePaymentMethod).toHaveBeenCalledWith(9, 'm1')
  })

  it('setDefaultPaymentMethod delegates', async () => {
    service.setDefaultPaymentMethod.mockResolvedValue({})
    await controller.setDefaultPaymentMethod(reqWithUser(9) as any, 'm1')
    expect(service.setDefaultPaymentMethod).toHaveBeenCalledWith(9, 'm1')
  })
})