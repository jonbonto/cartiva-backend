import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { ProductsModule } from './products/products.module'
import { CartModule } from './cart/cart.module'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ProductsModule, CartModule, AdminModule, AuthModule]
})
export class AppModule {}
