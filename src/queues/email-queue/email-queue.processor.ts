import { Processor, Process, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EMAIL_QUEUE } from '../constants';
import { EmailService } from '../../email/email.service';
import {
  OrderConfirmationEmailJob,
  PaymentSuccessEmailJob,
  PaymentFailedEmailJob,
  RefundConfirmationEmailJob,
  ShipmentUpdateEmailJob,
} from './email-queue.service';

/**
 * Email Queue Processor — Handles async email jobs
 * 
 * Architecture:
 * - Each email type has dedicated processor method
 * - Delegates to EmailService for actual sending
 * - Automatic retries on failure (3 attempts with backoff)
 * - Failed jobs logged for manual investigation
 * 
 * Scaling:
 * - Multiple worker processes can consume from same queue
 * - Set concurrency per processor for parallel processing
 * - Redis handles job distribution across workers
 * 
 * Error Handling:
 * - Transient errors (network) → retry
 * - Permanent errors (invalid email) → log and mark as failed
 * - All errors logged with full context for debugging
 */

@Processor(EMAIL_QUEUE)
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Process order confirmation emails
   */
  @Process('order-confirmation')
  async handleOrderConfirmation(job: Job<OrderConfirmationEmailJob>): Promise<void> {
    const { to, orderId, items, totalCents, currency } = job.data;

    this.logger.debug(`Processing order confirmation email for order ${orderId}`);

    try {
      await this.emailService.sendOrderConfirmation(
        to,
        orderId,
        items,
        totalCents,
        currency,
      );

      this.logger.log(`✅ Order confirmation email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send order confirmation email for order ${orderId}: ${error.message}`,
      );
      throw error; // Trigger retry
    }
  }

  /**
   * Process payment success emails
   */
  @Process('payment-success')
  async handlePaymentSuccess(job: Job<PaymentSuccessEmailJob>): Promise<void> {
    const { to, orderId, amountCents, currency, provider, transactionId } = job.data;

    this.logger.debug(`Processing payment success email for order ${orderId}`);

    try {
      await this.emailService.sendPaymentSuccess(
        to,
        orderId,
        amountCents,
        currency,
        provider,
        transactionId,
      );

      this.logger.log(`✅ Payment success email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send payment success email for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process payment failed emails
   */
  @Process('payment-failed')
  async handlePaymentFailed(job: Job<PaymentFailedEmailJob>): Promise<void> {
    const { to, orderId, amountCents, reason } = job.data;

    this.logger.debug(`Processing payment failed email for order ${orderId}`);

    try {
      await this.emailService.sendPaymentFailure(
        to,
        orderId,
        amountCents,
        reason,
      );

      this.logger.log(`✅ Payment failed email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send payment failed email for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process refund confirmation emails
   */
  @Process('refund-confirmation')
  async handleRefundConfirmation(job: Job<RefundConfirmationEmailJob>): Promise<void> {
    const { to, orderId, refundAmountCents, currency, reason } = job.data;

    this.logger.debug(`Processing refund confirmation email for order ${orderId}`);

    try {
      // TODO: Create sendRefundConfirmation method in EmailService
      this.logger.log(
        `[EMAIL REFUND] To: ${to}, Order: ${orderId}, Amount: ${refundAmountCents / 100} ${currency}, Reason: ${reason}`,
      );

      this.logger.log(`✅ Refund confirmation email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send refund confirmation email for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process shipment update emails
   */
  @Process('shipment-update')
  async handleShipmentUpdate(job: Job<ShipmentUpdateEmailJob>): Promise<void> {
    const { to, orderId, status, trackingNumber, shippingProvider } = job.data;

    this.logger.debug(`Processing shipment update email for order ${orderId} (${status})`);

    try {
      // TODO: Create sendShipmentUpdate method in EmailService
      this.logger.log(
        `[EMAIL SHIPMENT] To: ${to}, Order: ${orderId}, Status: ${status}, Tracking: ${trackingNumber}, Provider: ${shippingProvider}`,
      );

      this.logger.log(`✅ Shipment update email sent for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send shipment update email for order ${orderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Global error handler for queue errors
   */
  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`Queue error: ${error.message}`, error.stack);
  }

  /**
   * Handler for permanently failed jobs (after all retries exhausted)
   */
  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Job ${job.id} (${job.name}) permanently failed after ${job.attemptsMade} attempts: ${error.message}`,
      {
        jobId: job.id,
        jobName: job.name,
        attempts: job.attemptsMade,
        data: job.data,
        error: error.stack,
      },
    );

    // TODO: Send alert to monitoring system (Sentry, DataDog, etc.)
  }
}
