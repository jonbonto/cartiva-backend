export class DiscountRule {
  constructor(
    public id: string,
    public code: string | null,
    public type: 'percentage' | 'fixed_amount',
    public value: number,
    public appliesTo: string,
    public targetProductIds: number[],
    public minCartValueCents: number | null,
    public maxUsageCount: number | null,
    public usageCount: number,
    public isStackable: boolean,
    public priority: number,
    public isActive: boolean,
    public expiresAt: Date | null,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}
}
