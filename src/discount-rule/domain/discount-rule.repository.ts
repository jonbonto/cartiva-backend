import { DiscountRule } from './discount-rule.entity';

export abstract class DiscountRuleRepository {
  abstract create(input: {
    code?: string;
    type: 'percentage' | 'fixed_amount';
    value: number; // percent or cents depending on type
    appliesTo: string;
    targetProductIds?: number[];
    minCartValueCents?: number | null;
    isStackable?: boolean;
    priority?: number;
    isActive?: boolean;
    expiresAt?: Date | null;
  }): Promise<DiscountRule>;

  abstract findById(id: string): Promise<DiscountRule | null>;

  abstract findByCode(code: string): Promise<DiscountRule | null>;

  abstract findAll(filter?: { activeOnly?: boolean }): Promise<DiscountRule[]>;

  abstract update(id: string, patch: Partial<Record<string, any>>): Promise<DiscountRule>;

  abstract delete(id: string): Promise<void>;
}
