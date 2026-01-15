import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ShippingController } from './shipping.controller'
import { ShippingService } from './domain/shipping.service'
import { ShippingMethodsController } from './admin/shipping-methods.controller'
import { ShippingMethodsAdminService } from './admin/services/shipping-methods-admin.service'

@Module({
  imports: [PrismaModule],
  controllers: [ShippingController, ShippingMethodsController],
  providers: [ShippingService, ShippingMethodsAdminService],
  exports: [ShippingService],
})
export class ShippingModule {}
