import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { WebhookAdminController } from './webhook-admin.controller'
import { AdminOrdersController } from './admin-orders.controller'
import { AdminOrdersService } from './admin-orders.service'
import { ProductsModule } from '../products/products.module'
import { AuthModule } from '../auth/auth.module'
import { PaymentsModule } from '../payments/payments.module'
import { PrismaModule } from '../prisma/prisma.module'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [ProductsModule, AuthModule, PaymentsModule, PrismaModule, OrdersModule],
  controllers: [AdminController, WebhookAdminController, AdminOrdersController],
  providers: [AdminOrdersService],
})
export class AdminModule {}
