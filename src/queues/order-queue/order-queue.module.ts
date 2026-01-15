import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrderQueueService } from './order-queue.service';
import { OrderQueueProcessor } from './order-queue.processor';
import { EmailQueueModule } from '../email-queue/email-queue.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ORDER_QUEUE } from '../constants';

/**
 * Order Queue Module — Order lifecycle event processing
 * 
 * Purpose:
 * - Process order status changes asynchronously
 * - Trigger side effects (emails, analytics updates, stock updates)
 * - Handle fulfillment events (shipped, delivered)
 * 
 * Job Types:
 * - ORDER_STATUS_CHANGED: Process status transitions
 * - FULFILLMENT_UPDATED: Handle shipping/delivery events
 * - ORDER_CANCELLED: Handle cancellation side effects
 * 
 * Event Flow:
 * Admin updates order → Enqueue event → Processor handles side effects
 */

export const ORDER_EVENT_PUBLISHER = 'ORDER_EVENT_PUBLISHER';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ORDER_QUEUE,
    }),
    EmailQueueModule,
    PrismaModule,
  ],
  providers: [
    OrderQueueService,
    OrderQueueProcessor,
    { provide: ORDER_EVENT_PUBLISHER, useExisting: OrderQueueService },
  ],
  exports: [OrderQueueService, ORDER_EVENT_PUBLISHER],
})
export class OrderQueueModule {}
