import { Injectable } from '@nestjs/common';
import { DiscountRule } from '../domain/discount-rule.entity';
import { DiscountRuleRepository } from '../domain/discount-rule.repository';

@Injectable()
export class UpdateDiscountRuleUseCase {
  constructor(private readonly repo: DiscountRuleRepository) {}

  async execute(id: string, patch: Partial<Record<string, any>>): Promise<DiscountRule> {
    return this.repo.update(id, patch);
  }
}
