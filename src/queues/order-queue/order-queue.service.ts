import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ORDER_QUEUE } from '../constants';
import {
  OrderEventPublisher,
  OrderStatusChangedJob,
  FulfillmentUpdatedJob,
  OrderCancelledJob,
} from '../interfaces/order-event-publisher.interface';

/**
 * Order Queue Service — Enqueues order lifecycle events
 *
 * Implements the `OrderEventPublisher` port so other modules can depend on the
 * interface instead of the concrete queue implementation. This helps invert
 * dependencies and prevents direct coupling.
 */

@Injectable()
export class OrderQueueService implements OrderEventPublisher {
  private readonly logger = new Logger(OrderQueueService.name);

  constructor(
    @InjectQueue(ORDER_QUEUE)
    private readonly orderQueue: Queue,
  ) {}

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

  /**
   * Expose underlying Bull `Queue` instance for integrations (e.g. Bull Board)
   */
  getQueue(): Queue {
    return this.orderQueue;
  }
}
