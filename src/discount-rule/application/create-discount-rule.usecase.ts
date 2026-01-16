import { Injectable, Logger } from '@nestjs/common';
import { DiscountRule } from '../domain/discount-rule.entity';
import { DiscountRuleRepository } from '../domain/discount-rule.repository';
import { CreateDiscountRuleDto } from '../dto/create-discount-rule.dto';

@Injectable()
export class CreateDiscountRuleUseCase {
  constructor(
    private readonly repo: DiscountRuleRepository,
  ) {}

  async execute(input: CreateDiscountRuleDto): Promise<DiscountRule> {
    return this.repo.create(input as any);
  }
}
