import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

interface AnalyticsParams {
  from?: string;
  to?: string;
  granularity?: 'daily' | 'hourly';
}

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAnalytics(@Query() params: AnalyticsParams) {
    const granularity = params.granularity || 'daily';

    const fromDate = params.from
      ? new Date(params.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const toDate = params.to ? new Date(params.to) : new Date();

    // Fetch analytics snapshots within date range
    const snapshots = await this.prisma.analyticsSnapshot.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
        granularity,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Calculate summary stats
    const totalRevenue = snapshots.reduce(
      (sum, s) => sum + s.revenueCents,
      0
    );
    const totalOrders = snapshots.reduce(
      (sum, s) => sum + s.orderCount,
      0
    );
    const totalRefunds = snapshots.reduce(
      (sum, s) => sum + s.refundAmountCents,
      0
    );
    const totalRefundCount = snapshots.reduce(
      (sum, s) => sum + s.refundCount,
      0
    );
    const totalShipped = snapshots.reduce(
      (sum, s) => sum + s.shippedOrderCount,
      0
    );
    const totalDelivered = snapshots.reduce(
      (sum, s) => sum + s.deliveredOrderCount,
      0
    );

    return {
      success: true,
      data: snapshots.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        revenue: s.revenueCents / 100,
        orders: s.orderCount,
        paidOrders: s.paidOrderCount,
        failedOrders: s.failedOrderCount,
        refunds: s.refundCount,
        refundAmount: s.refundAmountCents / 100,
        shipped: s.shippedOrderCount,
        delivered: s.deliveredOrderCount,
        avgOrderValue: s.avgOrderValueCents / 100,
      })),
      summary: {
        totalRevenue: totalRevenue / 100,
        totalOrders,
        totalRefunds: totalRefunds / 100,
        totalRefundCount,
        totalShipped,
        totalDelivered,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders / 100 : 0,
        refundRate:
          totalOrders > 0
            ? (totalRefundCount / totalOrders) * 100
            : 0,
      },
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
    };
  }
}
