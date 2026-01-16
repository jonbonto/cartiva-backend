import { DiscountRuleController } from '../discount-rule.controller'
import { DiscountRuleRepositoryPrisma } from '../infrastructure/discount-rule.repository.prisma'
import { CreateDiscountRuleUseCase } from '../application/create-discount-rule.usecase'
import { GetDiscountRuleQuery } from '../application/get-discount-rule.query'
import { ListDiscountRulesQuery } from '../application/list-discount-rules.query'
import { UpdateDiscountRuleUseCase } from '../application/update-discount-rule.usecase'
import { DeleteDiscountRuleUseCase } from '../application/delete-discount-rule.usecase'

class FakePrisma {
  private store: Record<string, any> = {}
  private counter = 1

  discountRule = {
    create: async ({ data }: any) => {
      const id = `rule_${this.counter++}`
      const now = new Date().toISOString()
      const row = {
        id,
        code: data.code ?? null,
        type: data.type,
        value: data.value,
        appliesTo: data.appliesTo,
        targetProductIds: data.targetProductIds ?? [],
        minCartValueCents: data.minCartValueCents ?? null,
        maxUsageCount: data.maxUsageCount ?? null,
        usageCount: data.usageCount ?? 0,
        isStackable: data.isStackable ?? true,
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
        expiresAt: data.expiresAt ?? null,
        createdAt: now,
        updatedAt: now,
      }
      this.store[id] = row
      return row
    },

    findUnique: async ({ where }: any) => {
      return this.store[where.id] ?? null
    },

    findMany: async ({ where }: any) => {
      const rows = Object.values(this.store)
      if (where && where.isActive !== undefined) {
        return rows.filter((r: any) => r.isActive === where.isActive)
      }
      return rows
    },

    update: async ({ where, data }: any) => {
      const id = where.id
      if (!this.store[id]) throw new Error('Not found')
      const updated = { ...this.store[id], ...data, updatedAt: new Date().toISOString() }
      this.store[id] = updated
      return updated
    },

    delete: async ({ where }: any) => {
      const id = where.id
      if (this.store[id]) delete this.store[id]
      return
    },

    count: async () => {
      return Object.keys(this.store).length
    },
  }
}

describe('DiscountRule E2E-like (direct wiring)', () => {
  let controller: DiscountRuleController
  let fakePrisma: any

  beforeAll(() => {
    fakePrisma = new FakePrisma()
    const repo = new DiscountRuleRepositoryPrisma(fakePrisma as any)
    const createUse = new CreateDiscountRuleUseCase(repo as any)
    const getQuery = new GetDiscountRuleQuery(repo as any)
    const listQuery = new ListDiscountRulesQuery(repo as any)
    const updateUse = new UpdateDiscountRuleUseCase(repo as any)
    const deleteUse = new DeleteDiscountRuleUseCase(repo as any)

    controller = new DiscountRuleController(createUse as any, getQuery as any, listQuery as any, updateUse as any, deleteUse as any)
  })

  it('CRUD flow via controller methods', async () => {
    const createDto = {
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      appliesTo: 'cart_wide',
      isStackable: false,
      priority: 10,
      isActive: true,
    }

    const created = await controller.create(createDto as any)
    expect(created.code).toBe('SAVE10')
    expect(created.type).toBe('percentage')
    const id = created.id

    const fetched = await controller.get(id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(id)

    const list = await controller.list()
    expect(Array.isArray(list)).toBe(true)
    expect(list.find((r) => r.id === id)).toBeTruthy()

    const updateDto = { isActive: false, priority: 1 }
    const updated = await controller.update(id, updateDto as any)
    expect(updated.isActive).toBe(false)
    expect(updated.priority).toBe(1)

    await controller.delete(id)
    const after = await controller.get(id)
    expect(after).toBeNull()
  })
})
