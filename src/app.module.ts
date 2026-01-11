import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { ProductsModule } from './products/products.module'
import { CartModule } from './cart/cart.module'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { OrdersModule } from './orders/orders.module'
import { EnvironmentValidator } from './common/environment.validator'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProductsModule,
    CartModule,
    AdminModule,
    AuthModule,
    OrdersModule,
  ],
  providers: [EnvironmentValidator],
})
export class AppModule {}
