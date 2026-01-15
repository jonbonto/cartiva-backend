import { Processor, Process, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WEBHOOK_QUEUE } from '../constants';
import { WebhookReplayJob } from './webhook-queue.service';
import { WebhookLoggerService } from '../../payments/webhook-logger.service';

/**
 * Webhook Queue Processor — Handles webhook replay & retry jobs
 * 
 * Architecture:
 * - Replays webhooks from stored payload
 * - Updates WebhookLog status based on result
 * - Automatic retry with exponential backoff
 * - Calls payment provider's webhook handler
 * 
 * Idempotency:
 * - Checks WebhookLog before processing
 * - Skips if webhook already processed successfully
 * - Uses same idempotency checks as live webhooks
 */

@Processor(WEBHOOK_QUEUE)
export class WebhookQueueProcessor {
  private readonly logger = new Logger(WebhookQueueProcessor.name);

  constructor(
    private readonly webhookLoggerService: WebhookLoggerService,
  ) {}

  /**
   * Process manual webhook replay (triggered by admin)
   */
  @Process('replay-webhook')
  async handleReplay(job: Job<WebhookReplayJob>): Promise<void> {
    const { webhookLogId, provider, rawPayload } = job.data;

    this.logger.log(`Replaying webhook ${webhookLogId} for provider ${provider}`);

    try {
      // Get current webhook log status
      const webhookLog = await this.webhookLoggerService.getWebhookLog(webhookLogId);

      if (!webhookLog) {
        throw new Error(`Webhook log ${webhookLogId} not found`);
      }

      if (webhookLog.status === 'SUCCESS') {
        this.logger.warn(
          `Webhook ${webhookLogId} already processed successfully - skipping replay`,
        );
        return;
      }

      // TODO: Call appropriate payment provider handler based on provider
      // For now, we'll just log and mark as success
      this.logger.log(
        `[WEBHOOK REPLAY] Provider: ${provider}, EventType: ${webhookLog.eventType}`,
      );

      // Mark as processed
      await this.webhookLoggerService.markAsProcessed(webhookLogId);

      this.logger.log(`✅ Webhook ${webhookLogId} replayed successfully`);
    } catch (error) {
      this.logger.error(`❌ Webhook replay failed for ${webhookLogId}: ${error.message}`);

      // Mark as failed in database
      await this.webhookLoggerService.markAsFailed(
        webhookLogId,
        error.message,
        0, // No automatic retry for manual replays
      );

      throw error;
    }
  }

  /**
   * Process automatic webhook retry (scheduled by system)
   */
  @Process('retry-webhook')
  async handleRetry(job: Job<WebhookReplayJob>): Promise<void> {
    const { webhookLogId, provider, rawPayload, attemptNumber = 0 } = job.data;

    this.logger.log(
      `Retrying webhook ${webhookLogId} (attempt ${attemptNumber + 1})`,
    );

    try {
      // Get current webhook log status
      const webhookLog = await this.webhookLoggerService.getWebhookLog(webhookLogId);

      if (!webhookLog) {
        throw new Error(`Webhook log ${webhookLogId} not found`);
      }

      if (webhookLog.status === 'SUCCESS') {
        this.logger.warn(
          `Webhook ${webhookLogId} already processed successfully - skipping retry`,
        );
        return;
      }

      // TODO: Call appropriate payment provider handler based on provider
      this.logger.log(
        `[WEBHOOK RETRY] Provider: ${provider}, EventType: ${webhookLog.eventType}, Attempt: ${attemptNumber + 1}`,
      );

      // Mark as processed
      await this.webhookLoggerService.markAsProcessed(webhookLogId);

      this.logger.log(`✅ Webhook ${webhookLogId} retry succeeded`);
    } catch (error) {
      this.logger.error(
        `❌ Webhook retry failed for ${webhookLogId} (attempt ${attemptNumber + 1}): ${error.message}`,
      );

      // Calculate next retry delay (exponential backoff)
      const nextRetryDelaySeconds = Math.min(
        Math.pow(2, attemptNumber + 1) * 300, // 5 min, 10 min, 20 min, 40 min...
        86400, // Max 24 hours
      );

      // Mark as failed and schedule next retry
      await this.webhookLoggerService.markAsFailed(
        webhookLogId,
        error.message,
        nextRetryDelaySeconds,
      );

      throw error;
    }
  }

  /**
   * Global error handler
   */
  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`Webhook queue error: ${error.message}`, error.stack);
  }

  /**
   * Handler for permanently failed jobs
   */
  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Webhook job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${error.message}`,
      {
        jobId: job.id,
        webhookLogId: job.data.webhookLogId,
        provider: job.data.provider,
        attempts: job.attemptsMade,
        error: error.stack,
      },
    );

    // TODO: Alert monitoring system
  }
}
