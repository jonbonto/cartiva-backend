import { DiscountRuleController } from '../discount-rule.controller'
import { DiscountRule } from '../domain/discount-rule.entity'

describe('DiscountRuleController (unit)', () => {
  let controller: DiscountRuleController

  const mockCreateUseCase: any = { execute: jest.fn() }
  const mockGetQuery: any = { execute: jest.fn() }
  const mockListQuery: any = { execute: jest.fn() }
  const mockUpdateUseCase: any = { execute: jest.fn() }
  const mockDeleteUseCase: any = { execute: jest.fn() }

  beforeEach(() => {
    controller = new DiscountRuleController(
      mockCreateUseCase,
      mockGetQuery,
      mockListQuery,
      mockUpdateUseCase,
      mockDeleteUseCase,
    )
  })

  afterEach(() => jest.resetAllMocks())

  describe('POST /api/admin/discount-rules', () => {
    it('creates a percentage discount rule', async () => {
      const dto: any = {
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        appliesTo: 'cart_wide',
        isStackable: false,
        priority: 10,
        isActive: true,
      }

      const fakeRule = new DiscountRule(
        'rule_1',
        'SAVE10',
        'percentage',
        10,
        'cart_wide',
        [],
        null,
        null,
        0,
        false,
        10,
        true,
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T00:00:00Z'),
      )

      mockCreateUseCase.execute.mockResolvedValue(fakeRule)

      const res = await controller.create(dto)

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(dto)
      expect(res).toEqual(fakeRule)
      expect(res.code).toBe('SAVE10')
      expect(res.type).toBe('percentage')
      expect(res.value).toBe(10)
    })

    it('creates a fixed_amount discount rule', async () => {
      const dto: any = {
        code: 'FIVEOFF',
        type: 'fixed_amount',
        value: 500, // cents
        appliesTo: 'cart_wide',
        minCartValueCents: 2000,
        isStackable: true,
        priority: 5,
        isActive: true,
      }

      const fakeRule = new DiscountRule(
        'rule_2',
        'FIVEOFF',
        'fixed_amount',
        500,
        'cart_wide',
        [],
        2000,
        null,
        0,
        true,
        5,
        true,
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T00:00:00Z'),
      )

      mockCreateUseCase.execute.mockResolvedValue(fakeRule)

      const res = await controller.create(dto)

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(dto)
      expect(res.type).toBe('fixed_amount')
      expect(res.value).toBe(500)
      expect(res.minCartValueCents).toBe(2000)
      expect(res.isStackable).toBe(true)
    })
  })

  describe('GET /api/admin/discount-rules', () => {
    it('lists all discount rules', async () => {
      const fakeRules = [
        new DiscountRule(
          'rule_1',
          'SAVE10',
          'percentage',
          10,
          'cart_wide',
          [],
          null,
          null,
          0,
          false,
          10,
          true,
          null,
          new Date('2026-01-16T00:00:00Z'),
          new Date('2026-01-16T00:00:00Z'),
        ),
        new DiscountRule(
          'rule_2',
          'FIVEOFF',
          'fixed_amount',
          500,
          'cart_wide',
          [],
          2000,
          null,
          0,
          true,
          5,
          true,
          null,
          new Date('2026-01-16T00:00:00Z'),
          new Date('2026-01-16T00:00:00Z'),
        ),
      ]

      mockListQuery.execute.mockResolvedValue(fakeRules)

      const res = await controller.list()

      expect(mockListQuery.execute).toHaveBeenCalledWith(false)
      expect(res).toEqual(fakeRules)
      expect(res).toHaveLength(2)
      expect(res[0].code).toBe('SAVE10')
      expect(res[1].code).toBe('FIVEOFF')
    })

    it('returns empty array when no rules exist', async () => {
      mockListQuery.execute.mockResolvedValue([])

      const res = await controller.list()

      expect(res).toEqual([])
    })
  })

  describe('GET /api/admin/discount-rules/:id', () => {
    it('returns a single discount rule by id', async () => {
      const fakeRule = new DiscountRule(
        'rule_1',
        'SAVE10',
        'percentage',
        10,
        'cart_wide',
        [],
        null,
        null,
        0,
        false,
        10,
        true,
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T00:00:00Z'),
      )

      mockGetQuery.execute.mockResolvedValue(fakeRule)

      const res = await controller.get('rule_1')

      expect(mockGetQuery.execute).toHaveBeenCalledWith('rule_1')
      expect(res).toEqual(fakeRule)
      expect(res.id).toBe('rule_1')
    })

    it('returns null when rule not found', async () => {
      mockGetQuery.execute.mockResolvedValue(null)

      const res = await controller.get('nonexistent')

      expect(mockGetQuery.execute).toHaveBeenCalledWith('nonexistent')
      expect(res).toBeNull()
    })
  })

  describe('PUT /api/admin/discount-rules/:id', () => {
    it('updates a discount rule', async () => {
      const updateDto: any = {
        isActive: false,
        priority: 20,
      }

      const updatedRule = new DiscountRule(
        'rule_1',
        'SAVE10',
        'percentage',
        10,
        'cart_wide',
        [],
        null,
        null,
        0,
        false,
        20, // updated
        false, // updated
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T01:00:00Z'),
      )

      mockUpdateUseCase.execute.mockResolvedValue(updatedRule)

      const res = await controller.update('rule_1', updateDto)

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith('rule_1', updateDto)
      expect(res).toEqual(updatedRule)
      expect(res.isActive).toBe(false)
      expect(res.priority).toBe(20)
    })

    it('updates discount code and value', async () => {
      const updateDto: any = {
        code: 'NEWSAVE',
        value: 15,
      }

      const updatedRule = new DiscountRule(
        'rule_1',
        'NEWSAVE',
        'percentage',
        15,
        'cart_wide',
        [],
        null,
        null,
        0,
        false,
        10,
        true,
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T01:00:00Z'),
      )

      mockUpdateUseCase.execute.mockResolvedValue(updatedRule)

      const res = await controller.update('rule_1', updateDto)

      expect(res.code).toBe('NEWSAVE')
      expect(res.value).toBe(15)
    })
  })

  describe('DELETE /api/admin/discount-rules/:id', () => {
    it('deletes a discount rule', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(undefined)

      const res = await controller.delete('rule_1')

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith('rule_1')
      expect(res).toBeUndefined()
    })

    it('can delete multiple rules', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(undefined)

      await controller.delete('rule_1')
      await controller.delete('rule_2')

      expect(mockDeleteUseCase.execute).toHaveBeenCalledTimes(2)
      expect(mockDeleteUseCase.execute).toHaveBeenNthCalledWith(1, 'rule_1')
      expect(mockDeleteUseCase.execute).toHaveBeenNthCalledWith(2, 'rule_2')
    })
  })

  describe('edge cases and validation', () => {
    it('handles product-specific discount rules', async () => {
      const dto: any = {
        code: 'PRODUCT10',
        type: 'percentage',
        value: 10,
        appliesTo: 'specific_product',
        targetProductIds: [1, 2, 3],
        isStackable: true,
        priority: 5,
        isActive: true,
      }

      const fakeRule = new DiscountRule(
        'rule_3',
        'PRODUCT10',
        'percentage',
        10,
        'specific_product',
        [1, 2, 3],
        null,
        null,
        0,
        true,
        5,
        true,
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T00:00:00Z'),
      )

      mockCreateUseCase.execute.mockResolvedValue(fakeRule)

      const res = await controller.create(dto)

      expect(res.appliesTo).toBe('specific_product')
      expect(res.targetProductIds).toEqual([1, 2, 3])
    })

    it('handles discount rules with expiry', async () => {
      const expiryDate = new Date('2026-12-31T23:59:59Z')
      const dto: any = {
        code: 'HOLIDAY',
        type: 'percentage',
        value: 20,
        appliesTo: 'cart_wide',
        isStackable: false,
        priority: 100,
        isActive: true,
        expiresAt: expiryDate,
      }

      const fakeRule = new DiscountRule(
        'rule_4',
        'HOLIDAY',
        'percentage',
        20,
        'cart_wide',
        [],
        null,
        null,
        0,
        false,
        100,
        true,
        expiryDate,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T00:00:00Z'),
      )

      mockCreateUseCase.execute.mockResolvedValue(fakeRule)

      const res = await controller.create(dto)

      expect(res.expiresAt).toEqual(expiryDate)
    })

    it('handles discount rules with usage limits', async () => {
      const dto: any = {
        code: 'LIMITED',
        type: 'percentage',
        value: 15,
        appliesTo: 'cart_wide',
        maxUsageCount: 100,
        isStackable: true,
        priority: 10,
        isActive: true,
      }

      const fakeRule = new DiscountRule(
        'rule_5',
        'LIMITED',
        'percentage',
        15,
        'cart_wide',
        [],
        null,
        100, // maxUsageCount
        0, // usageCount
        true,
        10,
        true,
        null,
        new Date('2026-01-16T00:00:00Z'),
        new Date('2026-01-16T00:00:00Z'),
      )

      mockCreateUseCase.execute.mockResolvedValue(fakeRule)

      const res = await controller.create(dto)

      expect(res.maxUsageCount).toBe(100)
      expect(res.usageCount).toBe(0)
    })
  })
})
