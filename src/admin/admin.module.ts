import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { ProductsModule } from '../products/products.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [ProductsModule, AuthModule],
  controllers: [AdminController]
})
export class AdminModule {}
