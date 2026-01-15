import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module'
import { ReservationsController } from './admin/reservations.controller'
import { InventoryReservationsAdminService } from './inventory-reservations-admin.service'

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [ReservationsController],
  providers: [InventoryReservationsAdminService],
  exports: [InventoryReservationsAdminService],
})
export class InventoryModule {}
