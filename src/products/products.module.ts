import { Module } from '@nestjs/common'
import { ProductsService } from './products.service'
import { ProductsController } from './products.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditLogService } from '../audit/audit-log.service'

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService, AuditLogService],
  exports: [ProductsService]
})
export class ProductsModule {}
