import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Webhook Log Entry
 */
export interface WebhookLogEntry {
  provider: string
  eventType: string
  externalEventId?: string
  rawPayload: Record<string, any>
  headers: Record<string, any>
  idempotencyKey: string
  ipAddress?: string
  orderId?: string
  paymentId?: string
}

/**
 * PHASE 6: Webhook Logger Service
 *
 * Responsibilities:
 * - Persist all incoming webhook events for audit trail
 * - Provide replay mechanism for failed webhooks
 * - Ensure idempotency for webhook processing
 * - Support graceful error handling and retry logic
 *
 * Architecture:
 * - Injected into payment providers
 * - Non-blocking (fire-and-forget logging)
 * - Supports both sync and async operations
 * - Clean separation from business logic
 */
@Injectable()
export class WebhookLoggerService {
  private readonly logger = new Logger(WebhookLoggerService.name)

  constructor(private prisma: PrismaService) {}

  /**
   * Log incoming webhook
   * Call this immediately upon receiving webhook, before processing
   */
  async logWebhook(entry: WebhookLogEntry): Promise<string> {
    try {
      const webhookLog = await this.prisma.webhookLog.create({
        data: {
          provider: entry.provider,
          eventType: entry.eventType,
          externalEventId: entry.externalEventId,
          rawPayload: entry.rawPayload,
          headers: entry.headers,
          idempotencyKey: entry.idempotencyKey,
          ipAddress: entry.ipAddress,
          orderId: entry.orderId,
          paymentId: entry.paymentId,
          status: 'PENDING',
          createdAt: new Date(),
        },
      })

      this.logger.debug(
        `Webhook logged: ${entry.provider} - ${entry.eventType} (ID: ${webhookLog.id})`
      )

      return webhookLog.id
    } catch (error) {
      // If unique constraint violation (duplicate idempotency key), return existing
      if (error.code === 'P2002') {
        const existing = await this.prisma.webhookLog.findUnique({
          where: { idempotencyKey: entry.idempotencyKey },
        })
        if (existing) {
          this.logger.debug(
            `Webhook already logged (duplicate): ${entry.idempotencyKey}`
          )
          return existing.id
        }
      }

      this.logger.error(`Failed to log webhook: ${error.message}`)
      throw error
    }
  }

  /**
   * Mark webhook as successfully processed
   */
  async markAsProcessed(webhookLogId: string): Promise<void> {
    try {
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'SUCCESS',
          processedAt: new Date(),
          attempts: { increment: 1 },
        },
      })

      this.logger.debug(`Webhook marked as processed: ${webhookLogId}`)
    } catch (error) {
      this.logger.error(`Failed to mark webhook as processed: ${error.message}`)
      throw error
    }
  }

  /**
   * Mark webhook as failed and schedule retry
   */
  async markAsFailed(
    webhookLogId: string,
    errorMessage: string,
    retryAfterSeconds: number = 300
  ): Promise<void> {
    try {
      const nextRetry = new Date(Date.now() + retryAfterSeconds * 1000)

      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'FAILED',
          errorMessage,
          attempts: { increment: 1 },
          nextRetryAt: nextRetry,
        },
      })

      this.logger.warn(
        `Webhook marked as failed: ${webhookLogId}. Retry scheduled for ${nextRetry.toISOString()}`
      )
    } catch (error) {
      this.logger.error(`Failed to mark webhook as failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Get failed webhooks ready for retry
   */
  async getFailedWebhooksForRetry(
    limit: number = 50,
    maxAttempts: number = 5
  ): Promise<any[]> {
    try {
      const now = new Date()

      const failedWebhooks = await this.prisma.webhookLog.findMany({
        where: {
          status: 'FAILED',
          attempts: { lt: maxAttempts },
          nextRetryAt: { lte: now },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })

      return failedWebhooks
    } catch (error) {
      this.logger.error(
        `Failed to fetch webhooks for retry: ${error.message}`
      )
      throw error
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookLog(webhookLogId: string): Promise<any | null> {
    try {
      return await this.prisma.webhookLog.findUnique({
        where: { id: webhookLogId },
      })
    } catch (error) {
      this.logger.error(`Failed to fetch webhook log: ${error.message}`)
      throw error
    }
  }

  /**
   * List failed webhooks with pagination (admin API)
   */
  async listFailedWebhooks(
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    try {
      const skip = (page - 1) * pageSize

      const [data, total] = await Promise.all([
        this.prisma.webhookLog.findMany({
          where: { status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        this.prisma.webhookLog.count({
          where: { status: 'FAILED' },
        }),
      ])

      return { data, total, page, pageSize }
    } catch (error) {
      this.logger.error(`Failed to list failed webhooks: ${error.message}`)
      throw error
    }
  }

  /**
   * Prepare webhook for replay - resets status but keeps attempt count
   */
  async prepareForReplay(webhookLogId: string): Promise<any> {
    try {
      const webhookLog = await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'PENDING',
          errorMessage: null,
          nextRetryAt: null,
          processedAt: null,
        },
      })

      this.logger.log(
        `Webhook prepared for replay: ${webhookLogId} (attempt #${webhookLog.attempts + 1})`
      )

      return webhookLog
    } catch (error) {
      this.logger.error(`Failed to prepare webhook for replay: ${error.message}`)
      throw error
    }
  }

  /**
   * Check if webhook was already processed (by idempotency key)
   */
  async isWebhookDuplicate(idempotencyKey: string): Promise<boolean> {
    try {
      const existing = await this.prisma.webhookLog.findUnique({
        where: { idempotencyKey },
      })

      return !!existing
    } catch (error) {
      this.logger.error(`Failed to check webhook duplicate: ${error.message}`)
      return false
    }
  }

  /**
   * Get webhook statistics for monitoring
   */
  async getWebhookStats(): Promise<{
    total: number
    pending: number
    processing: number
    success: number
    failed: number
  }> {
    try {
      const [total, pending, processing, success, failed] = await Promise.all([
        this.prisma.webhookLog.count(),
        this.prisma.webhookLog.count({ where: { status: 'PENDING' } }),
        this.prisma.webhookLog.count({ where: { status: 'PROCESSING' } }),
        this.prisma.webhookLog.count({ where: { status: 'SUCCESS' } }),
        this.prisma.webhookLog.count({ where: { status: 'FAILED' } }),
      ])

      return { total, pending, processing, success, failed }
    } catch (error) {
      this.logger.error(`Failed to get webhook stats: ${error.message}`)
      throw error
    }
  }
}
