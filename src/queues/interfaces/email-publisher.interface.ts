export interface OrderConfirmationEmailJob {
  to: string;
  orderId: string;
  items: Array<{ productName: string; quantity: number; unitPriceCents: number }>;
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

export interface EmailPublisher {
  sendOrderConfirmation(data: OrderConfirmationEmailJob): Promise<void>;
  sendPaymentSuccess(data: PaymentSuccessEmailJob): Promise<void>;
  sendPaymentFailed(data: PaymentFailedEmailJob): Promise<void>;
  sendRefundConfirmation(data: RefundConfirmationEmailJob): Promise<void>;
  sendShipmentUpdate(data: ShipmentUpdateEmailJob): Promise<void>;
}
