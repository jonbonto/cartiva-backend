import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ORDER_QUEUE } from './order-queue.module';

/**
 * Order Queue Service — Enqueues order lifecycle events
 * 
 * Usage:
 * ```typescript
 * // Order status changed
 * await this.orderQueueService.orderStatusChanged({
 *   orderId: 'order_123',
 *   oldStatus: 'PENDING',
 *   newStatus: 'PAID',
 *   userId: 42
 * });
 * 
 * // Fulfillment updated
 * await this.orderQueueService.fulfillmentUpdated({
 *   orderId: 'order_123',
 *   fulfillmentStatus: 'shipped',
 *   trackingNumber: 'ABC123',
 *   shippingProvider: 'FedEx'
 * });
 * ```
 */

export interface OrderStatusChangedJob {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  userId?: number;
  userEmail?: string;
}

export interface FulfillmentUpdatedJob {
  orderId: string;
  fulfillmentStatus: string; // pending, processing, shipped, delivered, cancelled
  trackingNumber?: string;
  shippingProvider?: string;
  userId?: number;
  userEmail?: string;
}

export interface OrderCancelledJob {
  orderId: string;
  reason?: string;
  userId?: number;
  userEmail?: string;
}

@Injectable()
export class OrderQueueService {
  private readonly logger = new Logger(OrderQueueService.name);

  constructor(
    @InjectQueue(ORDER_QUEUE)
    private readonly orderQueue: Queue,
  ) {}

  /**
   * Enqueue order status change event
   * Triggers side effects like emails, analytics updates
   */
  async orderStatusChanged(data: OrderStatusChangedJob): Promise<void> {
    try {
      await this.orderQueue.add(
        'order-status-changed',
        data,
        {
          jobId: `status_${data.orderId}_${data.newStatus}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(
        `Enqueued status change for order ${data.orderId}: ${data.oldStatus} → ${data.newStatus}`,
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue order status change: ${error.message}`);
      // Don't throw - this is fire-and-forget
    }
  }

  /**
   * Enqueue fulfillment update event
   * Triggers customer notification emails
   */
  async fulfillmentUpdated(data: FulfillmentUpdatedJob): Promise<void> {
    try {
      await this.orderQueue.add(
        'fulfillment-updated',
        data,
        {
          jobId: `fulfillment_${data.orderId}_${data.fulfillmentStatus}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(
        `Enqueued fulfillment update for order ${data.orderId}: ${data.fulfillmentStatus}`,
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue fulfillment update: ${error.message}`);
    }
  }

  /**
   * Enqueue order cancellation event
   * Handles refunds, stock restoration, customer notifications
   */
  async orderCancelled(data: OrderCancelledJob): Promise<void> {
    try {
      await this.orderQueue.add(
        'order-cancelled',
        data,
        {
          jobId: `cancelled_${data.orderId}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(`Enqueued cancellation for order ${data.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue order cancellation: ${error.message}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.orderQueue.getWaitingCount(),
      this.orderQueue.getActiveCount(),
      this.orderQueue.getCompletedCount(),
      this.orderQueue.getFailedCount(),
      this.orderQueue.getDelayedCount(),
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
