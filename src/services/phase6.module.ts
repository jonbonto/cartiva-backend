import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxService } from './tax/tax.service';
import { ShippingService } from './shipping/shipping.service';
import { InventoryReservationService } from './inventory/inventory-reservation.service';

@Module({
  imports: [PrismaModule],
  providers: [TaxService, ShippingService, InventoryReservationService],
  exports: [TaxService, ShippingService, InventoryReservationService],
})
export class Phase6Module {}
