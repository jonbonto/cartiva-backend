import { Injectable } from '@nestjs/common';
import { DiscountRule } from '../domain/discount-rule.entity';
import { DiscountRuleRepository } from '../domain/discount-rule.repository';

@Injectable()
export class ListDiscountRulesQuery {
  constructor(private readonly repo: DiscountRuleRepository) {}

  async execute(activeOnly = false): Promise<DiscountRule[]> {
    return this.repo.findAll({ activeOnly });
  }
}
