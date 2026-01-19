import { OrdersController } from '../orders.controller'

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

  beforeEach(() => {
    controller = new OrdersController(
      mockOrdersService,
      mockOrderPaymentService,
      mockCreateOrderUseCase,
      mockCancelOrderUseCase,
      mockGetOrderQuery,
      mockGetCustomerOrdersQuery,
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
