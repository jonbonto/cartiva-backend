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

export interface OrderEventPublisher {
  orderStatusChanged(data: OrderStatusChangedJob): Promise<void>;
  fulfillmentUpdated(data: FulfillmentUpdatedJob): Promise<void>;
  orderCancelled(data: OrderCancelledJob): Promise<void>;
}
