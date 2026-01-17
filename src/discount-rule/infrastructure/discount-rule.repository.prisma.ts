import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscountRule } from '../domain/discount-rule.entity';
import { DiscountRuleRepository } from '../domain/discount-rule.repository';

@Injectable()
export class DiscountRuleRepositoryPrisma implements DiscountRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(db: any): DiscountRule {
    return new DiscountRule(
      String(db.id),
      db.code ?? null,
      db.type as 'percentage' | 'fixed_amount',
      db.value,
      db.appliesTo,
      db.targetProductIds ?? [],
      db.minCartValueCents ?? null,
      db.maxUsageCount ?? null,
      db.usageCount ?? 0,
      Boolean(db.isStackable),
      db.priority ?? 0,
      Boolean(db.isActive),
      db.expiresAt ? new Date(db.expiresAt) : null,
      new Date(db.createdAt),
      new Date(db.updatedAt),
    );
  }

  async create(input: {
    code?: string;
    type: 'percentage' | 'fixed_amount';
    value: number;
    appliesTo: string;
    targetProductIds?: number[];
    minCartValueCents?: number | null;
    isStackable?: boolean;
    priority?: number;
    isActive?: boolean;
    expiresAt?: Date | null;
  }): Promise<DiscountRule> {
    const db = await this.prisma.discountRule.create({
      data: {
        code: input.code ?? null,
        type: input.type,
        value: input.value,
        appliesTo: input.appliesTo,
        targetProductIds: input.targetProductIds ?? [],
        minCartValueCents: input.minCartValueCents ?? null,
        isStackable: input.isStackable ?? true,
        priority: input.priority ?? 0,
        isActive: input.isActive ?? true,
        expiresAt: input.expiresAt ?? null,
      },
    });

    return this.map(db);
  }

  async findById(id: string): Promise<DiscountRule | null> {
    const db = await this.prisma.discountRule.findUnique({ where: { id } });
    if (!db) return null;
    return this.map(db);
  }

  async findByCode(code: string): Promise<DiscountRule | null> {
    if (!code) return null
    const db = await this.prisma.discountRule.findUnique({ where: { code } });
    if (!db) return null
    return this.map(db)
  }

  async findAll(filter?: { activeOnly?: boolean }): Promise<DiscountRule[]> {
    const where: any = {};
    if (filter?.activeOnly) where.isActive = true;
    const rows = await this.prisma.discountRule.findMany({ where, orderBy: { priority: 'desc' } });
    return rows.map((r) => this.map(r));
  }

  async update(id: string, patch: Partial<Record<string, any>>): Promise<DiscountRule> {
    const db = await this.prisma.discountRule.update({ where: { id }, data: patch });
    return this.map(db);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.discountRule.delete({ where: { id } });
  }
}
