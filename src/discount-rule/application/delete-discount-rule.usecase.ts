import { Injectable } from '@nestjs/common';
import { DiscountRuleRepository } from '../domain/discount-rule.repository';

@Injectable()
export class DeleteDiscountRuleUseCase {
  constructor(private readonly repo: DiscountRuleRepository) {}

  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
