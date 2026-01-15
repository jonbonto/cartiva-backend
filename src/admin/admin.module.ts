import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
// Moved domain-specific admin controllers into their modules
import { ProductsModule } from '../products/products.module'
import { AuthModule } from '../auth/auth.module'
import { PaymentsModule } from '../payments/payments.module'
import { PrismaModule } from '../prisma/prisma.module'
import { FulfillmentModule } from '../fulfillment/fulfillment.module'
import { InventoryModule } from '../inventory/inventory.module'

/**
 * PHASE 1 REFACTORING: Circular Dependency Fix
 * 
 * Admin Orders functionality has been moved to OrdersModule/admin/
 * This breaks the circular dependency that existed between:
 * - Orders importing AdminOrdersController/Service from admin
 * - Admin importing OrdersModule to use OrderPaymentService
 * 
 * Admin Orders endpoints are now registered via OrdersModule
 * 
 * PHASE 2 REFACTORING: Service Layer Extraction
 * 
 * Controllers now delegate to service layer instead of accessing Prisma directly.
 * This improves testability, reusability, and separation of concerns.
 */
@Module({
  imports: [ProductsModule, AuthModule, PaymentsModule, PrismaModule, FulfillmentModule, InventoryModule],
  controllers: [AdminController],
  providers: [],
})
export class AdminModule {}
