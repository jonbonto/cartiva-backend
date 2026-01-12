import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WEBHOOK_QUEUE } from './webhook-queue.module';

/**
 * Webhook Queue Service — Enqueues webhook replay jobs
 * 
 * Usage:
 * ```typescript
 * // Replay failed webhook
 * await this.webhookQueueService.replayWebhook({
 *   webhookLogId: 'webhook_123',
 *   provider: 'stripe',
 *   rawPayload: {...}
 * });
 * 
 * // Schedule automatic retries
 * await this.webhookQueueService.scheduleRetry({
 *   webhookLogId: 'webhook_123',
 *   provider: 'stripe',
 *   rawPayload: {...},
 *   delayMs: 300000 // 5 minutes
 * });
 * ```
 */

export interface WebhookReplayJob {
  webhookLogId: string;
  provider: string; // stripe, midtrans, paypal
  rawPayload: any;
  headers?: any;
  attemptNumber?: number;
}

@Injectable()
export class WebhookQueueService {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue,
  ) {}

  /**
   * Enqueue webhook replay (manual trigger from admin)
   */
  async replayWebhook(data: WebhookReplayJob): Promise<void> {
    try {
      await this.webhookQueue.add(
        'replay-webhook',
        data,
        {
          jobId: `replay_${data.webhookLogId}`,
          attempts: 1, // Manual replay - no auto retry
          removeOnComplete: true,
        },
      );

      this.logger.log(`Enqueued webhook replay for ${data.webhookLogId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue webhook replay: ${error.message}`);
      throw error; // This one should throw since it's admin-triggered
    }
  }

  /**
   * Schedule automatic retry for failed webhook
   */
  async scheduleRetry(data: WebhookReplayJob & { delayMs: number }): Promise<void> {
    try {
      await this.webhookQueue.add(
        'retry-webhook',
        data,
        {
          jobId: `retry_${data.webhookLogId}_${data.attemptNumber || 0}`,
          delay: data.delayMs,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute base delay
          },
        },
      );

      this.logger.log(
        `Scheduled webhook retry for ${data.webhookLogId} in ${data.delayMs}ms`,
      );
    } catch (error) {
      this.logger.error(`Failed to schedule webhook retry: ${error.message}`);
      // Don't throw - this is fire-and-forget
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.webhookQueue.getWaitingCount(),
      this.webhookQueue.getActiveCount(),
      this.webhookQueue.getCompletedCount(),
      this.webhookQueue.getFailedCount(),
      this.webhookQueue.getDelayedCount(),
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
