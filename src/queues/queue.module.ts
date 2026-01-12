import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailQueueModule } from './email-queue/email-queue.module';
import { WebhookQueueModule } from './webhook-queue/webhook-queue.module';
import { AnalyticsQueueModule } from './analytics-queue/analytics-queue.module';
import { OrderQueueModule } from './order-queue/order-queue.module';
import { QueueMonitorController } from './queue-monitor.controller';

/**
 * Queue Module — Centralizes all Bull queue infrastructure
 * 
 * Architecture:
 * - Redis-based job queue using Bull
 * - Separate queues for different domains (email, webhooks, analytics, orders)
 * - Retry strategies with exponential backoff
 * - Job idempotency for critical operations
 * - Bull Board for admin monitoring
 * 
 * Queue Types:
 * 1. EmailQueue - Async email sending (SendGrid)
 * 2. WebhookQueue - Webhook replay & retries
 * 3. AnalyticsQueue - Data aggregation jobs
 * 4. OrderQueue - Order status updates & fulfillment events
 * 
 * Scaling:
 * - Each queue can have multiple workers (horizontal scaling)
 * - Redis connection pooling for high throughput
 * - Separate Redis instance recommended for production
 * 
 * Monitoring:
 * - Bull Board UI at /admin/queues (admin-only)
 * - Job status tracking (completed, failed, delayed)
 * - Retry attempt counts & failure logs
 */

@Module({
  imports: [
    // Configure Bull with Redis connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) {
              return null; // Stop retrying after 3 attempts
            }
            return Math.min(times * 1000, 3000); // Exponential backoff (1s, 2s, 3s)
          },
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2 seconds initial delay
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs for debugging
        },
      }),
      inject: [ConfigService],
    }),

    // Import domain-specific queue modules
    EmailQueueModule,
    WebhookQueueModule,
    AnalyticsQueueModule,
    OrderQueueModule,
  ],
  controllers: [QueueMonitorController],
  exports: [
    EmailQueueModule,
    WebhookQueueModule,
    AnalyticsQueueModule,
    OrderQueueModule,
  ],
})
export class QueueModule {}
