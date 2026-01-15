import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_EVENT_PUBLISHER } from '../queues/order-queue/order-queue.module';
import { OrderEventPublisher } from '../queues/interfaces/order-event-publisher.interface';

/**
 * Fulfillment Service — Manages order fulfillment lifecycle
 * 
 * Purpose:
 * - Update fulfillment status (pending → processing → shipped → delivered)
 * - Record shipping provider and tracking number
 * - Emit events to queue for customer notifications
 * - Validate status transitions
 * 
 * Fulfillment Statuses:
 * - pending: Order created, awaiting processing
 * - processing: Order being prepared for shipment
 * - shipped: Order handed to carrier
 * - delivered: Order delivered to customer
 * - cancelled: Order cancelled (no shipment)
 * 
 * Valid Transitions:
 * - pending → processing
 * - pending → cancelled
 * - processing → shipped
 * - processing → cancelled
 * - shipped → delivered
 * - shipped → cancelled (RTO - Return to Origin)
 */

export interface UpdateFulfillmentDto {
  fulfillmentStatus?: string;
  shippingProvider?: string;
  trackingNumber?: string;
}

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  // Valid fulfillment statuses
  private readonly VALID_STATUSES = [
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ];

  // Valid status transitions
  private readonly VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'], // cancelled = RTO
    delivered: [], // Terminal state
    cancelled: [], // Terminal state
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ORDER_EVENT_PUBLISHER)
    private readonly orderEventPublisher: OrderEventPublisher,
  ) {}

  /**
   * Update order fulfillment details
   * 
   * @param orderId - Order ID to update
   * @param dto - Fulfillment update data
   * @param adminId - Admin user making the update
   * @returns Updated order with fulfillment details
   */
  async updateFulfillment(
    orderId: string,
    dto: UpdateFulfillmentDto,
    adminId?: number,
  ): Promise<any> {
    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Validate status transition if status is being updated
    if (dto.fulfillmentStatus) {
      this.validateStatusTransition(
        order.fulfillmentStatus,
        dto.fulfillmentStatus,
      );
    }

    // Validate shipping info if status is being set to shipped
    if (dto.fulfillmentStatus === 'shipped') {
      if (!dto.trackingNumber && !order.trackingNumber) {
        throw new BadRequestException(
          'Tracking number required when marking order as shipped',
        );
      }
      if (!dto.shippingProvider && !order.shippingProvider) {
        throw new BadRequestException(
          'Shipping provider required when marking order as shipped',
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.fulfillmentStatus) {
      updateData.fulfillmentStatus = dto.fulfillmentStatus;

      // Set timestamps based on status
      if (dto.fulfillmentStatus === 'shipped' && !order.shippedAt) {
        updateData.shippedAt = new Date();
      }
      if (dto.fulfillmentStatus === 'delivered' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }

    if (dto.shippingProvider) {
      updateData.shippingProvider = dto.shippingProvider;
    }

    if (dto.trackingNumber) {
      updateData.trackingNumber = dto.trackingNumber;
    }

    // Update order in database
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        user: true,
        items: true,
        payment: true,
      },
    });

    this.logger.log(
      `Fulfillment updated for order ${orderId}: ${order.fulfillmentStatus} → ${updatedOrder.fulfillmentStatus}`,
    );

    // Emit fulfillment update event to queue (async)
    if (dto.fulfillmentStatus) {
      await this.orderEventPublisher.fulfillmentUpdated({
        orderId: updatedOrder.id,
        fulfillmentStatus: updatedOrder.fulfillmentStatus,
        trackingNumber: updatedOrder.trackingNumber,
        shippingProvider: updatedOrder.shippingProvider,
        userId: updatedOrder.userId,
        userEmail: updatedOrder.user?.email,
      }).catch((error) => {
        this.logger.warn(
          `Failed to enqueue fulfillment event for order ${orderId}: ${error.message}`,
        );
        // Don't throw - queue is non-critical
      });
    }

    return this.formatOrderForResponse(updatedOrder);
  }

  /**
   * Get fulfillment timeline for an order
   * Returns all fulfillment status changes with timestamps
   */
  async getFulfillmentTimeline(orderId: string): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        fulfillmentStatus: true,
        shippingProvider: true,
        trackingNumber: true,
        createdAt: true,
        shippedAt: true,
        deliveredAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Build timeline from timestamps
    const timeline = [];

    timeline.push({
      status: 'pending',
      timestamp: order.createdAt,
      completed: true,
    });

    if (order.fulfillmentStatus !== 'pending') {
      timeline.push({
        status: 'processing',
        timestamp: null, // We don't track processing timestamp currently
        completed: ['processing', 'shipped', 'delivered'].includes(
          order.fulfillmentStatus,
        ),
      });
    }

    if (order.shippedAt || order.fulfillmentStatus === 'shipped') {
      timeline.push({
        status: 'shipped',
        timestamp: order.shippedAt,
        completed: true,
        trackingNumber: order.trackingNumber,
        shippingProvider: order.shippingProvider,
      });
    }

    if (order.deliveredAt || order.fulfillmentStatus === 'delivered') {
      timeline.push({
        status: 'delivered',
        timestamp: order.deliveredAt,
        completed: order.fulfillmentStatus === 'delivered',
      });
    }

    if (order.fulfillmentStatus === 'cancelled') {
      timeline.push({
        status: 'cancelled',
        timestamp: null,
        completed: true,
      });
    }

    return {
      orderId: order.id,
      currentStatus: order.fulfillmentStatus,
      timeline,
    };
  }

  /**
   * Validate status transition is allowed
   */
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): void {
    // Validate status is valid
    if (!this.VALID_STATUSES.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid fulfillment status: ${newStatus}. Must be one of: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    // No change
    if (currentStatus === newStatus) {
      return;
    }

    // Check if transition is allowed
    const allowedTransitions = this.VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
      );
    }
  }

  /**
   * Format order for API response
   */
  private formatOrderForResponse(order: any): any {
    return {
      id: order.id,
      userId: order.userId,
      fulfillmentStatus: order.fulfillmentStatus,
      shippingProvider: order.shippingProvider,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
