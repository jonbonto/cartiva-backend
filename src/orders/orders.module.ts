import { Module } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderPaymentService } from './payment.service'
import { OrdersController } from './orders.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { CartModule } from '../cart/cart.module'
import { ProductsModule } from '../products/products.module'
import { PaymentsModule } from '../payments/payments.module'
import { EmailModule } from '../email/email.module'
import { AdminOrdersController } from '../admin/admin-orders.controller'
import { AdminOrdersService } from '../admin/admin-orders.service'
import { Phase6Module } from '../services/phase6.module'

@Module({
  imports: [PrismaModule, CartModule, ProductsModule, PaymentsModule, EmailModule, Phase6Module],
  providers: [OrdersService, OrderPaymentService, AdminOrdersService],
  controllers: [OrdersController, AdminOrdersController],
  exports: [OrdersService, OrderPaymentService],
})
export class OrdersModule {}

