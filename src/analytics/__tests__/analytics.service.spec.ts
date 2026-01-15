import { AnalyticsService } from '../analytics.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('AnalyticsService', () => {
  let service: AnalyticsService
  const mockPrisma: any = {}

  beforeEach(() => {
    mockPrisma.analyticsSnapshot = {
      findMany: jest.fn(),
    }

    service = new AnalyticsService(mockPrisma as unknown as PrismaService)
  })

  it('returns formatted data and correct summary', async () => {
    const snapshots = [
      {
        date: new Date('2026-01-01'),
        revenueCents: 10000,
        orderCount: 2,
        refundAmountCents: 500,
        refundCount: 1,
        shippedOrderCount: 1,
        deliveredOrderCount: 1,
        paidOrderCount: 2,
        failedOrderCount: 0,
        avgOrderValueCents: 5000,
      },
      {
        date: new Date('2026-01-02'),
        revenueCents: 20000,
        orderCount: 3,
        refundAmountCents: 0,
        refundCount: 0,
        shippedOrderCount: 2,
        deliveredOrderCount: 2,
        paidOrderCount: 3,
        failedOrderCount: 0,
        avgOrderValueCents: 6666,
      },
    ]

    mockPrisma.analyticsSnapshot.findMany.mockResolvedValue(snapshots)

    const res = await service.getAnalytics({ from: '2026-01-01', to: '2026-01-02', granularity: 'daily' })

    expect(res.success).toBe(true)
    expect(res.data.length).toBe(2)
    expect(res.data[0].date).toBe('2026-01-01')
    expect(res.summary.totalRevenue).toBe((10000 + 20000) / 100)
    expect(res.summary.totalOrders).toBe(5)
    // avgOrderValue = totalRevenue / totalOrders / 100
    expect(res.summary.avgOrderValue).toBe((10000 + 20000) / 5 / 100)
  })

  it('handles empty snapshots gracefully', async () => {
    mockPrisma.analyticsSnapshot.findMany.mockResolvedValue([])
    const res = await service.getAnalytics({})
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
    expect(res.summary.totalRevenue).toBe(0)
    expect(res.summary.totalOrders).toBe(0)
  })
})
