import { Controller, Get, All, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Queue } from 'bull';
import { UI, setQueues } from 'bull-board';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EMAIL_QUEUE, WEBHOOK_QUEUE, ANALYTICS_QUEUE, ORDER_QUEUE } from './constants';
import { EmailQueueService } from './email-queue/email-queue.service';
import { WebhookQueueService } from './webhook-queue/webhook-queue.service';
import { AnalyticsQueueService } from './analytics-queue/analytics-queue.service';
import { OrderQueueService } from './order-queue/order-queue.service';

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

@Controller('api/admin/queues')
@UseGuards(JwtAuthGuard, AdminGuard)
export class QueueMonitorController {
  private bullBoard: any;

  constructor(
    private readonly emailQueueService: EmailQueueService,
    private readonly webhookQueueService: WebhookQueueService,
    private readonly analyticsQueueService: AnalyticsQueueService,
    private readonly orderQueueService: OrderQueueService,
  ) {
    // Initialize Bull Board (older bull-board API): register queues and use exported UI app
    setQueues([
      this.emailQueueService.getQueue(),
      this.webhookQueueService.getQueue(),
      this.analyticsQueueService.getQueue(),
      this.orderQueueService.getQueue(),
    ]);
    this.bullBoard = UI;
  }

  /**
   * GET /admin/queues
   * Renders Bull Board UI
   */
  @Get()
  async viewQueues(@Req() req: Request, @Res() res: Response) {
    // Bull Board app handles the request
    this.bullBoard(req, res);
  }

  /**
   * GET /admin/queues/stats
   * Returns queue statistics (JSON API)
   */
  @Get('stats')
  async getQueueStats() {
    const [emailStats, webhookStats, analyticsStats, orderStats] = await Promise.all([
      this.getStats(this.emailQueueService.getQueue()),
      this.getStats(this.webhookQueueService.getQueue()),
      this.getStats(this.analyticsQueueService.getQueue()),
      this.getStats(this.orderQueueService.getQueue()),
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
   * Catch-all handler for Bull Board static assets and sub-routes
   * Ensures requests like /api/admin/queues/static/* are handled by the UI
   */
  @All('*')
  async handleAll(@Req() req: Request, @Res() res: Response) {
    this.bullBoard(req, res);
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
