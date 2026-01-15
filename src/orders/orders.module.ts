import { Module } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { OrderPaymentService } from './payment.service'
import { OrdersController } from './orders.controller'
import { AdminOrdersController } from './admin/admin-orders.controller'
import { AdminOrdersService } from './admin/admin-orders.service'
import { PrismaModule } from '../prisma/prisma.module'
import { CartModule } from '../cart/cart.module'
import { ProductsModule } from '../products/products.module'
import { PaymentsModule } from '../payments/payments.module'
import { EmailModule } from '../email/email.module'
import { DomainServicesModule } from '../services/phase6.module'
import { OrderRepositoryPrisma } from './infrastructure/order.repository.prisma'
import { CreateOrderUseCase } from './application/create-order.usecase'
import { CancelOrderUseCase } from './application/cancel-order.usecase'
import { ORDER_REPOSITORY } from './domain/order.repository'

@Module({
  imports: [PrismaModule, CartModule, ProductsModule, PaymentsModule, EmailModule, DomainServicesModule],
  providers: [
    OrdersService,
    OrderPaymentService,
    AdminOrdersService,
    { provide: ORDER_REPOSITORY, useClass: OrderRepositoryPrisma },
    CreateOrderUseCase,
    CancelOrderUseCase,
  ],
  controllers: [OrdersController, AdminOrdersController],
  exports: [OrdersService, OrderPaymentService],
})
export class OrdersModule {}

