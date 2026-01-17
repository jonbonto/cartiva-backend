import { Module } from '@nestjs/common';
import { DiscountRuleController } from './discount-rule.controller';
import { DiscountRulePublicController } from './discount-rule.public.controller';
import { CreateDiscountRuleUseCase } from './application/create-discount-rule.usecase';
import { GetDiscountRuleQuery } from './application/get-discount-rule.query';
import { ListDiscountRulesQuery } from './application/list-discount-rules.query';
import { UpdateDiscountRuleUseCase } from './application/update-discount-rule.usecase';
import { DeleteDiscountRuleUseCase } from './application/delete-discount-rule.usecase';
import { ValidateDiscountUseCase } from './application/validate-discount.usecase';
import { DiscountRuleRepository } from './domain/discount-rule.repository';
import { DiscountRuleRepositoryPrisma } from './infrastructure/discount-rule.repository.prisma';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DiscountRuleController, DiscountRulePublicController],
  providers: [
    CreateDiscountRuleUseCase,
    GetDiscountRuleQuery,
    ListDiscountRulesQuery,
    UpdateDiscountRuleUseCase,
    DeleteDiscountRuleUseCase,
    ValidateDiscountUseCase,
    { provide: DiscountRuleRepository, useClass: DiscountRuleRepositoryPrisma },
    PrismaService,
  ],
  exports: [CreateDiscountRuleUseCase, GetDiscountRuleQuery, ListDiscountRulesQuery, ValidateDiscountUseCase],
})
export class DiscountRuleModule {}
