export interface OrderStatusChangedJob {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  userId?: number;
  userEmail?: string;
}

export interface FulfillmentUpdatedJob {
  orderId: string;
  fulfillmentStatus: string;
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

/**
 * Refund event for affiliate commission cancellation
 */
export interface RefundProcessedJob {
  refundId: string;
  orderId: string;
  orderItemId?: string; // For partial refunds
  isPartial: boolean;
  amountCents: number;
  reason: string;
}

export interface OrderEventPublisher {
  orderStatusChanged(data: OrderStatusChangedJob): Promise<void>;
  fulfillmentUpdated(data: FulfillmentUpdatedJob): Promise<void>;
  orderCancelled(data: OrderCancelledJob): Promise<void>;
  refundProcessed?(data: RefundProcessedJob): Promise<void>; // Optional - for affiliate integration
}
