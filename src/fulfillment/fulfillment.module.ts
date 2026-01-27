import { Module } from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service';
import { FulfillmentController } from './fulfillment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queues/queue.module';
import { AffiliateModule } from '../affiliate/affiliate.module';

/**
 * Fulfillment Module — Order shipping and delivery management
 * 
 * Features:
 * - Update fulfillment status
 * - Record shipping provider and tracking number
 * - Track shipment timeline
 * - Emit events to queue for customer notifications
 * 
 * Integration:
 * - Uses OrderQueue to notify customers
 * - Updates Order model in database
 * - Protected by admin guards
 */

@Module({
  imports: [PrismaModule, QueueModule, AffiliateModule],
  providers: [FulfillmentService],
  controllers: [FulfillmentController],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
