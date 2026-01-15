import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { WebhookAdminController } from './webhook-admin.controller'
import { TaxRulesController } from './tax-rules.controller'
import { ShippingMethodsController } from './shipping-methods.controller'
import { ReservationsController } from './reservations.controller'
import { ProductsModule } from '../products/products.module'
import { AuthModule } from '../auth/auth.module'
import { PaymentsModule } from '../payments/payments.module'
import { PrismaModule } from '../prisma/prisma.module'
import { FulfillmentModule } from '../fulfillment/fulfillment.module'

/**
 * PHASE 1 REFACTORING: Circular Dependency Fix
 * 
 * Admin Orders functionality has been moved to OrdersModule/admin/
 * This breaks the circular dependency that existed between:
 * - Orders importing AdminOrdersController/Service from admin
 * - Admin importing OrdersModule to use OrderPaymentService
 * 
 * Admin Orders endpoints are now registered via OrdersModule
 */
@Module({
  imports: [ProductsModule, AuthModule, PaymentsModule, PrismaModule, FulfillmentModule],
  controllers: [
    AdminController,
    WebhookAdminController,
    TaxRulesController,
    ShippingMethodsController,
    ReservationsController,
  ],
  providers: [],
})
export class AdminModule {}
