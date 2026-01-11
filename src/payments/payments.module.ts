/**
 * PHASE 5.1: Payments Module
 * 
 * Registers real payment providers (Stripe, Midtrans) with the payment service.
 * Makes them available for order checkout.
 */

import { Module } from '@nestjs/common'
import { StripePaymentProvider } from './stripe.provider'
import { MidtransPaymentProvider } from './midtrans.provider'

@Module({
  providers: [StripePaymentProvider, MidtransPaymentProvider],
  exports: [StripePaymentProvider, MidtransPaymentProvider],
})
export class PaymentsModule {}
