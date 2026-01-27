import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailQueueModule } from './email-queue/email-queue.module';
import { WebhookQueueModule } from './webhook-queue/webhook-queue.module';
import { AnalyticsQueueModule } from './analytics-queue/analytics-queue.module';
import { OrderQueueModule } from './order-queue/order-queue.module';
import { AffiliateQueueModule } from './affiliate-queue/affiliate-queue.module';
import { QueueMonitorController } from './queue-monitor.controller';

/**
 * Queue Module — Centralizes all Bull queue infrastructure
 * 
 * Architecture:
 * - Redis-based job queue using Bull
 * - Separate queues for different domains (email, webhooks, analytics, orders, affiliate)
 * - Retry strategies with exponential backoff
 * - Job idempotency for critical operations
 * - Bull Board for admin monitoring
 * 
 * Queue Types:
 * 1. EmailQueue - Async email sending (SendGrid)
 * 2. WebhookQueue - Webhook replay & retries
 * 3. AnalyticsQueue - Data aggregation jobs
 * 4. OrderQueue - Order status updates & fulfillment events
 * 5. AffiliateQueue - Affiliate tracking, commissions, payouts
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
    // Global Bull configuration is provided at AppModule level

    // Import domain-specific queue modules
    EmailQueueModule,
    WebhookQueueModule,
    AnalyticsQueueModule,
    OrderQueueModule,
    AffiliateQueueModule,
  ],
  controllers: [QueueMonitorController],
  exports: [
    EmailQueueModule,
    WebhookQueueModule,
    AnalyticsQueueModule,
    OrderQueueModule,
    AffiliateQueueModule,
  ],
})
export class QueueModule {}
