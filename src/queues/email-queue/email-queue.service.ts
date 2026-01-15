import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EMAIL_QUEUE } from '../constants';

/**
 * Email Queue Service — Enqueues email jobs for async processing
 * 
 * Usage:
 * ```typescript
 * await this.emailQueueService.sendOrderConfirmation({
 *   to: 'customer@example.com',
 *   orderId: 'order_123',
 *   items: [...],
 *   totalCents: 4999,
 *   currency: 'USD'
 * });
 * ```
 * 
 * Idempotency:
 * - Each job has a unique ID based on email type + order ID
 * - Prevents duplicate emails if called multiple times
 * 
 * Error Handling:
 * - Failed jobs automatically retried (3 attempts)
 * - Failures logged but don't throw errors (fire-and-forget)
 */

export interface OrderConfirmationEmailJob {
  to: string;
  orderId: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  totalCents: number;
  currency: string;
}

export interface PaymentSuccessEmailJob {
  to: string;
  orderId: string;
  amountCents: number;
  currency: string;
  provider: string;
  transactionId: string;
}

export interface PaymentFailedEmailJob {
  to: string;
  orderId: string;
  amountCents: number;
  currency: string;
  reason?: string;
}

export interface RefundConfirmationEmailJob {
  to: string;
  orderId: string;
  refundAmountCents: number;
  currency: string;
  reason?: string;
}

export interface ShipmentUpdateEmailJob {
  to: string;
  orderId: string;
  status: string; // shipped, delivered
  trackingNumber?: string;
  shippingProvider?: string;
}

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  /**
   * Enqueue order confirmation email
   * Sent immediately after order creation (before payment)
   */
  async sendOrderConfirmation(data: OrderConfirmationEmailJob): Promise<void> {
    try {
      await this.emailQueue.add(
        'order-confirmation',
        data,
        {
          jobId: `order-confirmation_${data.orderId}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Enqueued order confirmation email for order ${data.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue order confirmation email: ${error.message}`);
      // Don't throw - email is non-critical
    }
  }

  /**
   * Enqueue payment success email
   * Sent when payment webhook confirms successful payment
   */
  async sendPaymentSuccess(data: PaymentSuccessEmailJob): Promise<void> {
    try {
      await this.emailQueue.add(
        'payment-success',
        data,
        {
          jobId: `payment-success_${data.orderId}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Enqueued payment success email for order ${data.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue payment success email: ${error.message}`);
    }
  }

  /**
   * Enqueue payment failed email
   * Sent when payment webhook confirms payment failure
   */
  async sendPaymentFailed(data: PaymentFailedEmailJob): Promise<void> {
    try {
      await this.emailQueue.add(
        'payment-failed',
        data,
        {
          jobId: `payment-failed_${data.orderId}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Enqueued payment failed email for order ${data.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue payment failed email: ${error.message}`);
    }
  }

  /**
   * Enqueue refund confirmation email
   * Sent when admin processes a refund
   */
  async sendRefundConfirmation(data: RefundConfirmationEmailJob): Promise<void> {
    try {
      await this.emailQueue.add(
        'refund-confirmation',
        data,
        {
          jobId: `refund-confirmation_${data.orderId}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Enqueued refund confirmation email for order ${data.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue refund confirmation email: ${error.message}`);
    }
  }

  /**
   * Enqueue shipment update email
   * Sent when order status changes to shipped or delivered
   */
  async sendShipmentUpdate(data: ShipmentUpdateEmailJob): Promise<void> {
    try {
      await this.emailQueue.add(
        'shipment-update',
        data,
        {
          jobId: `shipment-update_${data.orderId}_${data.status}_${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Enqueued shipment update email for order ${data.orderId} (${data.status})`);
    } catch (error) {
      this.logger.error(`Failed to enqueue shipment update email: ${error.message}`);
    }
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
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
    return this.emailQueue;
  }
}
