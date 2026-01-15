import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
/**
 * Analytics Queue Module — Background data aggregation
 * 
 * Purpose:
 * - Aggregate analytics data without blocking requests
 * - Calculate daily/hourly metrics (revenue, orders, refunds)
 * - Pre-compute dashboard data for fast loading
 * 
 * Job Types:
 * - DAILY_AGGREGATION: Run once per day (revenue, orders, refunds)
 * - HOURLY_AGGREGATION: Run every hour (recent trends)
 * - REFRESH_CACHE: Refresh dashboard cache on demand
 * 
 * Scheduling:
 * - Cron-based jobs via @nestjs/schedule
 * - Manual triggers from admin dashboard
 */

import { AnalyticsQueueService } from './analytics-queue.service';
import { AnalyticsQueueProcessor } from './analytics-queue.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { ANALYTICS_QUEUE } from '../constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
    }),
    PrismaModule,
  ],
  providers: [AnalyticsQueueService, AnalyticsQueueProcessor],
  exports: [AnalyticsQueueService],
})
export class AnalyticsQueueModule {}
