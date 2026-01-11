import { Module } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderPaymentService } from './payment.service'
import { OrdersController } from './orders.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { CartModule } from '../cart/cart.module'
import { ProductsModule } from '../products/products.module'
import { PaymentsModule } from '../payments/payments.module'

@Module({
  imports: [PrismaModule, CartModule, ProductsModule, PaymentsModule],
  providers: [OrdersService, OrderPaymentService],
  controllers: [OrdersController],
  exports: [OrdersService, OrderPaymentService],
})
export class OrdersModule {}
