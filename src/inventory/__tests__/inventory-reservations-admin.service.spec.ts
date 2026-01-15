import { InventoryReservationsAdminService } from '../inventory-reservations-admin.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('InventoryReservationsAdminService', () => {
  let service: InventoryReservationsAdminService
  const mockPrisma: any = {}

  beforeEach(() => {
    mockPrisma.inventoryReservation = {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    }
    mockPrisma.product = { findMany: jest.fn() }

    service = new InventoryReservationsAdminService(mockPrisma as unknown as PrismaService)
  })

  it('listReservations enriches product names', async () => {
    const reservations = [{ id: 'r1', productId: 10 }]
    mockPrisma.inventoryReservation.findMany.mockResolvedValue(reservations)
    mockPrisma.inventoryReservation.count.mockResolvedValue(1)
    mockPrisma.product.findMany.mockResolvedValue([{ id: 10, name: 'Widget' }])

    const res = await service.listReservations(undefined, { by: 'createdAt', order: 'desc' }, { limit: 20, offset: 0 })
    expect(res.data[0].productName).toBe('Widget')
  })

  it('releaseReservation validates and updates', async () => {
    mockPrisma.inventoryReservation.findUnique.mockResolvedValue({ id: 'r1', status: 'RESERVED' })
    mockPrisma.inventoryReservation.update.mockResolvedValue({ id: 'r1', status: 'RELEASED' })

    const res = await service.releaseReservation('r1', 'out of stock')
    expect(res.status).toBe('RELEASED')
  })

  it('releaseReservation throws when not found', async () => {
    mockPrisma.inventoryReservation.findUnique.mockResolvedValue(null)
    await expect(service.releaseReservation('nope')).rejects.toThrow()
  })
})
