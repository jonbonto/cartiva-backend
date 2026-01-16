export class UpdateDiscountRuleDto {
  code?: string;
  type?: 'percentage' | 'fixed_amount';
  value?: number;
  appliesTo?: string;
  targetProductIds?: number[];
  minCartValueCents?: number | null;
  isStackable?: boolean;
  priority?: number;
  isActive?: boolean;
  expiresAt?: Date | null;
}
