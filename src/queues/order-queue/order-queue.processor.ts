import { Processor, Process, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { ORDER_QUEUE } from '../constants';
import { OrderStatusChangedJob, FulfillmentUpdatedJob, OrderCancelledJob } from '../interfaces/order-event-publisher.interface';
import { EMAIL_PUBLISHER } from '../email-queue/email-queue.module';
import { EmailPublisher } from '../interfaces/email-publisher.interface';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Order Queue Processor — Handles order lifecycle events
 * 
 * Architecture:
 * - Processes order events asynchronously
 * - Triggers cascading actions (emails, analytics, stock)
 * - Maintains eventual consistency
 * 
 * Side Effects:
 * - Send customer emails
 * - Update analytics aggregates
 * - Restore stock on cancellation
 * - Log audit trail
 */

@Processor(ORDER_QUEUE)
export class OrderQueueProcessor {
  private readonly logger = new Logger(OrderQueueProcessor.name);

  constructor(
    @Inject(EMAIL_PUBLISHER)
    private readonly emailPublisher: EmailPublisher,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process order status changes
   */
  @Process('order-status-changed')
  async handleOrderStatusChanged(job: Job<OrderStatusChangedJob>): Promise<void> {
    const { orderId, oldStatus, newStatus, userEmail } = job.data;

    this.logger.log(`Processing status change for order ${orderId}: ${oldStatus} → ${newStatus}`);

    try {
      // Handle specific status transitions
      if (newStatus === 'PAID' && oldStatus !== 'PAID') {
        // Payment confirmed
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { user: true, payment: true },
        });

        if (order && order.user) {
          // Send payment success email
          await this.emailPublisher.sendPaymentSuccess({
            to: order.user.email,
            orderId: order.id,
            amountCents: order.finalTotalAmountCents,
            currency: order.currency,
            provider: order.payment?.provider || 'unknown',
            transactionId: order.payment?.providerPaymentId || '',
          });
        }
      }

      if (newStatus === 'PAYMENT_FAILED') {
        // Payment failed
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { user: true },
        });

        if (order && order.user) {
          // Send payment failed email
          await this.emailPublisher.sendPaymentFailed({
            to: order.user.email,
            orderId: order.id,
            amountCents: order.finalTotalAmountCents,
            currency: order.currency,
            reason: 'Payment processing failed',
          });
        }
      }

      this.logger.log(`✅ Status change processed for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to process status change for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process fulfillment updates
   */
  @Process('fulfillment-updated')
  async handleFulfillmentUpdated(job: Job<FulfillmentUpdatedJob>): Promise<void> {
    const {
      orderId,
      fulfillmentStatus,
      trackingNumber,
      shippingProvider,
      userEmail,
    } = job.data;

    this.logger.log(
      `Processing fulfillment update for order ${orderId}: ${fulfillmentStatus}`,
    );

    try {
      // Get order details
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Send notification emails for shipped/delivered status
      if (
        (fulfillmentStatus === 'shipped' || fulfillmentStatus === 'delivered') &&
        order.user
      ) {
        await this.emailPublisher.sendShipmentUpdate({
          to: order.user.email,
          orderId: order.id,
          status: fulfillmentStatus,
          trackingNumber,
          shippingProvider,
        });
      }

      this.logger.log(`✅ Fulfillment update processed for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to process fulfillment update for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process order cancellations
   */
  @Process('order-cancelled')
  async handleOrderCancelled(job: Job<OrderCancelledJob>): Promise<void> {
    const { orderId, reason, userEmail } = job.data;

    this.logger.log(`Processing cancellation for order ${orderId}`);

    try {
      // Get order details
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, user: true },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // TODO: Restore stock for cancelled order
      // for (const item of order.items) {
      //   await this.prisma.product.update({
      //     where: { id: item.productId },
      //     data: { stock: { increment: item.quantity } }
      //   });
      // }

      // TODO: Send cancellation email to customer
      this.logger.log(
        `[ORDER CANCELLED] Order ${orderId}, Reason: ${reason}, Items: ${order.items.length}`,
      );

      this.logger.log(`✅ Cancellation processed for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to process cancellation for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Global error handler
   */
  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`Order queue error: ${error.message}`, error.stack);
  }

  /**
   * Handler for permanently failed jobs
   */
  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Order job ${job.id} (${job.name}) permanently failed: ${error.message}`,
      {
        jobId: job.id,
        jobName: job.name,
        data: job.data,
        error: error.stack,
      },
    );

    // TODO: Alert monitoring system
  }
}
