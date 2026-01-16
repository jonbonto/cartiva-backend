import { Injectable } from '@nestjs/common';
import { DiscountRule } from '../domain/discount-rule.entity';
import { DiscountRuleRepository } from '../domain/discount-rule.repository';

@Injectable()
export class GetDiscountRuleQuery {
  constructor(private readonly repo: DiscountRuleRepository) {}

  async execute(id: string): Promise<DiscountRule | null> {
    return this.repo.findById(id);
  }
}
