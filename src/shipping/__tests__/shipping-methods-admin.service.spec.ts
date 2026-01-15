import { ShippingMethodsAdminService } from '../admin/services/shipping-methods-admin.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('ShippingMethodsAdminService', () => {
  let service: ShippingMethodsAdminService
  const mockPrisma: any = {}

  beforeEach(() => {
    mockPrisma.shippingMethod = {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    service = new ShippingMethodsAdminService(mockPrisma as unknown as PrismaService)
  })

  it('listShippingMethods returns data and meta', async () => {
    const sample = [{ id: 's1', name: 'Fast' }]
    mockPrisma.shippingMethod.findMany.mockResolvedValue(sample)
    mockPrisma.shippingMethod.count.mockResolvedValue(1)

    const res = await service.listShippingMethods(undefined, { by: 'name', order: 'asc' }, { limit: 20, offset: 0 })
    expect(res.data).toEqual(sample)
    expect(res.meta.total).toBe(1)
  })

  it('createShippingMethod validates and creates', async () => {
    const dto = { name: 'X', baseCostCents: 1000, minDeliveryDays: 1, maxDeliveryDays: 2, supportedCountries: [] }
    mockPrisma.shippingMethod.create.mockResolvedValue({ id: 'm1', ...dto })

    const created = await service.createShippingMethod(dto as any)
    expect(created.id).toBe('m1')
    expect(mockPrisma.shippingMethod.create).toHaveBeenCalled()
  })

  it('updateShippingMethod throws when not found', async () => {
    mockPrisma.shippingMethod.findUnique.mockResolvedValue(null)
    await expect(service.updateShippingMethod('nope', {} as any)).rejects.toThrow()
  })

  it('deleteShippingMethod returns success', async () => {
    mockPrisma.shippingMethod.findUnique.mockResolvedValue({ id: 'm1' })
    mockPrisma.shippingMethod.delete.mockResolvedValue({})

    const res = await service.deleteShippingMethod('m1')
    expect(res).toEqual({ success: true })
  })
})
