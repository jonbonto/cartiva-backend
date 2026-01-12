import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ANALYTICS_QUEUE } from './analytics-queue.module';

/**
 * Analytics Queue Service — Schedules analytics aggregation jobs
 * 
 * Usage:
 * ```typescript
 * // Trigger daily aggregation
 * await this.analyticsQueueService.aggregateDailyMetrics({
 *   date: new Date('2026-01-12')
 * });
 * 
 * // Refresh dashboard cache
 * await this.analyticsQueueService.refreshDashboardCache();
 * ```
 */

export interface DailyAggregationJob {
  date: Date; // Date to aggregate (usually yesterday)
}

export interface HourlyAggregationJob {
  hour: Date; // Hour to aggregate
}

@Injectable()
export class AnalyticsQueueService {
  private readonly logger = new Logger(AnalyticsQueueService.name);

  constructor(
    @InjectQueue(ANALYTICS_QUEUE)
    private readonly analyticsQueue: Queue,
  ) {}

  /**
   * Aggregate daily metrics (revenue, orders, refunds)
   * Typically scheduled to run at 1 AM for previous day
   */
  async aggregateDailyMetrics(data: DailyAggregationJob): Promise<void> {
    try {
      const dateStr = data.date.toISOString().split('T')[0];

      await this.analyticsQueue.add(
        'daily-aggregation',
        data,
        {
          jobId: `daily_${dateStr}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
        },
      );

      this.logger.log(`Enqueued daily aggregation for ${dateStr}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue daily aggregation: ${error.message}`);
    }
  }

  /**
   * Aggregate hourly metrics for real-time dashboard
   * Runs every hour
   */
  async aggregateHourlyMetrics(data: HourlyAggregationJob): Promise<void> {
    try {
      const hourStr = data.hour.toISOString().substring(0, 13); // YYYY-MM-DDTHH

      await this.analyticsQueue.add(
        'hourly-aggregation',
        data,
        {
          jobId: `hourly_${hourStr}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000, // 30 seconds
          },
        },
      );

      this.logger.log(`Enqueued hourly aggregation for ${hourStr}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue hourly aggregation: ${error.message}`);
    }
  }

  /**
   * Refresh dashboard cache (triggered manually or on critical events)
   */
  async refreshDashboardCache(): Promise<void> {
    try {
      await this.analyticsQueue.add(
        'refresh-cache',
        {},
        {
          jobId: `cache_refresh_${Date.now()}`,
          attempts: 1,
        },
      );

      this.logger.log('Enqueued dashboard cache refresh');
    } catch (error) {
      this.logger.error(`Failed to enqueue cache refresh: ${error.message}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.analyticsQueue.getWaitingCount(),
      this.analyticsQueue.getActiveCount(),
      this.analyticsQueue.getCompletedCount(),
      this.analyticsQueue.getFailedCount(),
      this.analyticsQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
