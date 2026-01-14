import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createBullBoard } from 'bull-board';
import { BullAdapter } from 'bull-board';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EMAIL_QUEUE } from '../queues/email-queue/email-queue.module';
import { WEBHOOK_QUEUE } from '../queues/webhook-queue/webhook-queue.module';
import { ANALYTICS_QUEUE } from '../queues/analytics-queue/analytics-queue.module';
import { ORDER_QUEUE } from '../queues/order-queue/order-queue.module';

/**
 * Queue Monitor Controller — Bull Board admin interface
 * 
 * Purpose:
 * - Provides web UI for monitoring all job queues
 * - View waiting, active, completed, and failed jobs
 * - Retry failed jobs manually
 * - View job details, logs, and stack traces
 * 
 * Access:
 * - Admin-only (requires JWT + admin role)
 * - Route: /admin/queues
 * 
 * Bull Board Features:
 * - Real-time job status
 * - Retry/remove individual jobs
 * - View job data and results
 * - Clean up completed/failed jobs
 * 
 * Security:
 * - Protected with JwtAuthGuard + AdminGuard
 * - Read-only by default (write operations require confirmation)
 */

@Controller('admin/queues')
@UseGuards(JwtAuthGuard, AdminGuard)
export class QueueMonitorController {
  private bullBoard: any;

  constructor(
    @InjectQueue(EMAIL_QUEUE) private emailQueue: Queue,
    @InjectQueue(WEBHOOK_QUEUE) private webhookQueue: Queue,
    @InjectQueue(ANALYTICS_QUEUE) private analyticsQueue: Queue,
    @InjectQueue(ORDER_QUEUE) private orderQueue: Queue,
  ) {
    // Initialize Bull Board with all queues
    this.bullBoard = createBullBoard([
      new BullAdapter(this.emailQueue),
      new BullAdapter(this.webhookQueue),
      new BullAdapter(this.analyticsQueue),
      new BullAdapter(this.orderQueue),
    ]);
  }

  /**
   * GET /admin/queues
   * Renders Bull Board UI
   */
  @Get()
  async viewQueues(@Req() req: Request, @Res() res: Response) {
    // Bull Board router handles the request
    const { router } = this.bullBoard;
    router(req, res);
  }

  /**
   * GET /admin/queues/stats
   * Returns queue statistics (JSON API)
   */
  @Get('stats')
  async getQueueStats() {
    const [emailStats, webhookStats, analyticsStats, orderStats] = await Promise.all([
      this.getStats(this.emailQueue),
      this.getStats(this.webhookQueue),
      this.getStats(this.analyticsQueue),
      this.getStats(this.orderQueue),
    ]);

    return {
      queues: {
        email: emailStats,
        webhook: webhookStats,
        analytics: analyticsStats,
        order: orderStats,
      },
      totalJobs:
        emailStats.total +
        webhookStats.total +
        analyticsStats.total +
        orderStats.total,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper to get queue statistics
   */
  private async getStats(queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
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
