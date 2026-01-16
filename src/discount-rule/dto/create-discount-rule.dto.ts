export class CreateDiscountRuleDto {
  code?: string;
  type: 'percentage' | 'fixed_amount';
  value: number; // percent for percentage, cents for fixed_amount
  appliesTo: string;
  targetProductIds?: number[];
  minCartValueCents?: number | null;
  isStackable?: boolean;
  priority?: number;
  isActive?: boolean;
  expiresAt?: Date | null;
}
