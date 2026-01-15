import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TaxController } from './tax.controller'
import { TaxService } from './domain/tax.service'
import { TaxRulesController } from './admin/tax-rules.controller'
import { TaxRulesAdminService } from './admin/services/tax-rules-admin.service'

@Module({
  imports: [PrismaModule],
  controllers: [TaxController, TaxRulesController],
  providers: [TaxService, TaxRulesAdminService],
  exports: [TaxService],
})
export class TaxModule {}
