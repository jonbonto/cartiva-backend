import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebhookQueueService } from './webhook-queue.service';
import { WebhookQueueProcessor } from './webhook-queue.processor';
import { PaymentsModule } from '../../payments/payments.module';

/**
 * Webhook Queue Module — Async webhook replay & retry
 * 
 * Purpose:
 * - Replay failed webhooks from admin interface
 * - Automatic retry for transient failures
 * - Decouple webhook processing from HTTP request lifecycle
 * 
 * Job Types:
 * - REPLAY_WEBHOOK: Manual replay triggered by admin
 * - RETRY_WEBHOOK: Automatic retry for failed webhooks
 * 
 * Idempotency:
 * - Job IDs based on webhook log ID
 * - Prevents duplicate processing of same webhook
 */

export const WEBHOOK_QUEUE = 'webhook-queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEBHOOK_QUEUE,
    }),
    PaymentsModule,
  ],
  providers: [WebhookQueueService, WebhookQueueProcessor],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
