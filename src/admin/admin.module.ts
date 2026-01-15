import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { WebhookAdminController } from './webhook-admin.controller'
import { AdminOrdersController } from './admin-orders.controller'
import { AdminOrdersService } from './admin-orders.service'
import { TaxRulesController } from './tax-rules.controller'
import { ShippingMethodsController } from './shipping-methods.controller'
import { ReservationsController } from './reservations.controller'
import { ProductsModule } from '../products/products.module'
import { AuthModule } from '../auth/auth.module'
import { PaymentsModule } from '../payments/payments.module'
import { PrismaModule } from '../prisma/prisma.module'
import { OrdersModule } from '../orders/orders.module'
import { FulfillmentModule } from '../fulfillment/fulfillment.module'

@Module({
  imports: [ProductsModule, AuthModule, PaymentsModule, PrismaModule, OrdersModule, FulfillmentModule],
  controllers: [
    AdminController,
    WebhookAdminController,
    AdminOrdersController,
    TaxRulesController,
    ShippingMethodsController,
    ReservationsController,
  ],
  providers: [AdminOrdersService],
})
export class AdminModule {}
