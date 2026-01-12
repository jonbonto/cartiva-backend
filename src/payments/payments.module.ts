/**
 * PHASE 5.1: Payments Module
 * 
 * Registers real payment providers (Stripe, Midtrans) with the payment service.
 * Makes them available for order checkout.
 */

import { Module } from '@nestjs/common'
import { StripePaymentProvider } from './stripe.provider'
import { MidtransPaymentProvider } from './midtrans.provider'
import { WebhookLoggerService } from './webhook-logger.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [
    StripePaymentProvider,
    MidtransPaymentProvider,
    WebhookLoggerService,
  ],
  exports: [
    StripePaymentProvider,
    MidtransPaymentProvider,
    WebhookLoggerService,
  ],
})
export class PaymentsModule {}
