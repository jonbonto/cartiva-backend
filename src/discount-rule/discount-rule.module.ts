import { Module } from '@nestjs/common';
import { DiscountRuleController } from './discount-rule.controller';
import { CreateDiscountRuleUseCase } from './application/create-discount-rule.usecase';
import { GetDiscountRuleQuery } from './application/get-discount-rule.query';
import { ListDiscountRulesQuery } from './application/list-discount-rules.query';
import { UpdateDiscountRuleUseCase } from './application/update-discount-rule.usecase';
import { DeleteDiscountRuleUseCase } from './application/delete-discount-rule.usecase';
import { DiscountRuleRepository } from './domain/discount-rule.repository';
import { DiscountRuleRepositoryPrisma } from './infrastructure/discount-rule.repository.prisma';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DiscountRuleController],
  providers: [
    CreateDiscountRuleUseCase,
    GetDiscountRuleQuery,
    ListDiscountRulesQuery,
    UpdateDiscountRuleUseCase,
    DeleteDiscountRuleUseCase,
    { provide: DiscountRuleRepository, useClass: DiscountRuleRepositoryPrisma },
    PrismaService,
  ],
  exports: [CreateDiscountRuleUseCase, GetDiscountRuleQuery, ListDiscountRulesQuery],
})
export class DiscountRuleModule {}
