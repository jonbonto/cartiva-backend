import { OrdersController } from '../orders.controller'
import { FeatureFlag } from '../../feature-flags/feature-flags.service'
import { BadRequestException } from '@nestjs/common'

describe('OrdersController (unit)', () => {
  let controller: OrdersController

  const mockOrdersService: any = {
    getOrderById: jest.fn(),
    getCustomerOrders: jest.fn(),
  }

  const mockOrderPaymentService: any = {
    createPayment: jest.fn(),
    handleWebhook: jest.fn(),
    checkPaymentStatus: jest.fn(),
    refundPayment: jest.fn(),
  }

  const mockCreateOrderUseCase: any = { execute: jest.fn() }
  const mockCancelOrderUseCase: any = { execute: jest.fn() }
  const mockGetOrderQuery: any = { execute: jest.fn() }
  const mockGetCustomerOrdersQuery: any = { execute: jest.fn() }
  const mockFeatureFlags: any = { isEnabled: jest.fn() }
  const mockUsersService: any = { getAddress: jest.fn() }

  beforeEach(() => {
    controller = new OrdersController(
      mockOrdersService,
      mockOrderPaymentService,
      mockCreateOrderUseCase,
      mockCancelOrderUseCase,
      mockGetOrderQuery,
      mockGetCustomerOrdersQuery,
      mockFeatureFlags,
      mockUsersService,
    )
  })

  afterEach(() => jest.resetAllMocks())

  it('POST /checkout returns created order shape', async () => {
    const dto: any = { cartId: 123, currency: 'USD' }
    const req: any = { user: { id: 42 } }

    const fakeOrder: any = {
      id: 'order_1',
      currency: 'USD',
      items: [{ id: 'i1' }],
      subtotalCents: 1000,
      taxCents: 100,
      shippingCents: 200,
      calculateTotal: () => 1300,
      createdAt: new Date('2025-01-01T00:00:00Z'),
    }

    mockCreateOrderUseCase.execute.mockResolvedValue(fakeOrder)

    const res = await controller.checkout(dto, req)

    expect(mockCreateOrderUseCase.execute).toHaveBeenCalledWith({
      userId: 42,
      currency: 'USD',
      cartId: 123,
      items: [],
      address: undefined,
      shippingMethodId: undefined,
    })

    expect(res.id).toBe('order_1')
    expect(res.currency).toBe('USD')
    expect(res.items).toEqual(fakeOrder.items)
    expect(res.subtotal).toBe(1000)
    expect(res.taxCents).toBe(100)
    expect(res.shippingCents).toBe(200)
    // Accept either legacy `finalTotal` (cents) or new `finalTotalAmountCents`
    const finalCents = (res as any).finalTotalAmountCents ?? res.finalTotal
    expect(finalCents).toBe(1300)
    expect(res.createdAt).toEqual(fakeOrder.createdAt)
  })

  it('POST /checkout resolves saved address when flag enabled', async () => {
    const dto: any = { cartId: 321, currency: 'USD', shippingAddressId: 'addr_1' }
    const req: any = { user: { id: 7 } }

    mockFeatureFlags.isEnabled.mockReturnValue(true)

    const saved = {
      id: 'addr_1',
      country: 'US',
      stateProvince: 'NY',
      city: 'New York',
      postalCode: '10001',
    }

    mockUsersService.getAddress.mockResolvedValue(saved)

    const fakeOrder: any = {
      id: 'order_x',
      currency: 'USD',
      items: [],
      subtotalCents: 0,
      taxCents: 0,
      shippingCents: 0,
      calculateTotal: () => 0,
      createdAt: new Date(),
    }

    mockCreateOrderUseCase.execute.mockResolvedValue(fakeOrder)

    const res = await controller.checkout(dto, req)

    expect(mockUsersService.getAddress).toHaveBeenCalledWith(7, 'addr_1')
    expect(mockCreateOrderUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      currency: 'USD',
      cartId: 321,
      address: { country: 'US', state: 'NY', city: 'New York', postalCode: '10001' },
    }))
    expect(res.id).toBe('order_x')
  })

  it('POST /checkout ignores shippingAddressId when flag disabled', async () => {
    const dto: any = { cartId: 555, currency: 'USD', shippingAddressId: 'addr_2' }
    const req: any = { user: { id: 9 } }

    mockFeatureFlags.isEnabled.mockReturnValue(false)

    const fakeOrder: any = {
      id: 'order_y',
      currency: 'USD',
      items: [],
      subtotalCents: 0,
      taxCents: 0,
      shippingCents: 0,
      calculateTotal: () => 0,
      createdAt: new Date(),
    }

    mockCreateOrderUseCase.execute.mockResolvedValue(fakeOrder)

    const res = await controller.checkout(dto, req)

    expect(mockUsersService.getAddress).not.toHaveBeenCalled()
    expect(mockCreateOrderUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      userId: 9,
      currency: 'USD',
      cartId: 555,
      address: undefined,
    }))
    expect(res.id).toBe('order_y')
  })

  it('POST /checkout with invalid saved id returns 400', async () => {
    const dto: any = { cartId: 777, currency: 'USD', shippingAddressId: 'addr_missing' }
    const req: any = { user: { id: 10 } }

    mockFeatureFlags.isEnabled.mockReturnValue(true)
    mockUsersService.getAddress.mockResolvedValue(null)

    await expect(controller.checkout(dto, req)).rejects.toThrow(BadRequestException)
  })

  it('GET /:id returns order details (legacy shape)', async () => {
    const req: any = { user: { id: 42 } }
    const dbOrder: any = {
      id: 'order_2',
      userId: '42',
      currency: 'USD',
      items: [{ id: 'i1', productName: 'P', quantity: 1, unitPriceCents: 1000, subtotalAmountCents: 1000 }],
      subtotalAmountCents: 1000,
      discountTotalAmountCents: 0,
      finalTotalAmountCents: 1000,
      status: 'PENDING',
      payment: { id: 'p1', provider: 'stripe', status: 'pending' },
      createdAt: new Date('2025-01-02T00:00:00Z'),
    }

    mockOrdersService.getOrderById.mockResolvedValue(dbOrder)

    const res = await controller.getOrder('order_2', req)

    expect(mockOrdersService.getOrderById).toHaveBeenCalledWith('order_2', 42)
    expect(res).toEqual({
      id: 'order_2',
      userId: '42',
      currency: 'USD',
      items: dbOrder.items,
      subtotal: 1000,
      discountTotal: 0,
      finalTotal: 1000,
      status: 'PENDING',
      payment: {
        id: 'p1',
        provider: 'stripe',
        status: 'pending',
      },
      createdAt: dbOrder.createdAt,
    })
  })

  it('GET / returns customer orders listing', async () => {
    const req: any = { user: { id: 42 } }
    const requestMock: any = { query: { page: '1', limit: '10' } }

    const resp = {
      orders: [{ id: 'o1' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }

    mockOrdersService.getCustomerOrders.mockResolvedValue(resp)

    const result = await controller.getCustomerOrders(req, requestMock)

    expect(mockOrdersService.getCustomerOrders).toHaveBeenCalledWith({
      userId: 42,
      page: 1,
      limit: 10,
      status: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    expect(result).toEqual({ success: true, data: resp.orders, pagination: resp.pagination })
  })
})
