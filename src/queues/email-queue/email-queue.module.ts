import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailQueueService } from './email-queue.service';
import { EmailQueueProcessor } from './email-queue.processor';
import { EmailModule } from '../../email/email.module';

/**
 * Email Queue Module — Async email sending via Bull queue
 * 
 * Purpose:
 * - Decouple email sending from critical request paths
 * - Retry failed emails automatically
 * - Prevent email failures from blocking order creation/payment
 * 
 * Job Types:
 * - ORDER_CONFIRMATION: Sent when order created
 * - PAYMENT_SUCCESS: Sent when payment confirmed
 * - PAYMENT_FAILED: Sent when payment fails
 * - REFUND_CONFIRMATION: Sent when refund processed
 * - SHIPMENT_UPDATE: Sent when order shipped/delivered
 * 
 * Idempotency:
 * - Job IDs based on: ${emailType}_${orderId}_${timestamp}
 * - Prevents duplicate emails for same event
 * 
 * Retry Strategy:
 * - 3 attempts with exponential backoff (2s, 4s, 8s)
 * - Failed jobs logged for manual investigation
 */

export const EMAIL_QUEUE = 'email-queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
    }),
    EmailModule,
  ],
  providers: [EmailQueueService, EmailQueueProcessor],
  exports: [EmailQueueService],
})
export class EmailQueueModule {}
