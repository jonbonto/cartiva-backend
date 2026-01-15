import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service'

interface AnalyticsParams {
  from?: string;
  to?: string;
  granularity?: 'daily' | 'hourly';
}

@Controller('api/admin/analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService, private prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAnalytics(@Query() params: AnalyticsParams) {
    return this.analyticsService.getAnalytics(params);
  }
}
