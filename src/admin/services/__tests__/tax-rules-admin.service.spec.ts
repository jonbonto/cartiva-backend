import { TaxRulesAdminService } from '../tax-rules-admin.service'
import { PrismaService } from '../../../prisma/prisma.service'

describe('TaxRulesAdminService', () => {
  let service: TaxRulesAdminService
  const mockPrisma: any = {}

  beforeEach(() => {
    mockPrisma.taxRule = {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    service = new TaxRulesAdminService(mockPrisma as unknown as PrismaService)
  })

  it('listTaxRules returns formatted paging', async () => {
    const sample = [{ id: '1', country: 'US' }]
    mockPrisma.taxRule.findMany.mockResolvedValue(sample)
    mockPrisma.taxRule.count.mockResolvedValue(1)

    const res = await service.listTaxRules(undefined, { by: 'country', order: 'asc' }, { limit: 20, offset: 0 })

    expect(res.data).toEqual(sample)
    expect(res.meta.total).toBe(1)
  })

  it('createTaxRule validates and creates', async () => {
    const dto = { country: 'us', taxRate: 10 }
    mockPrisma.taxRule.create.mockResolvedValue({ id: 'r1', ...dto })

    const created = await service.createTaxRule(dto as any)
    expect(created.id).toBe('r1')
    expect(mockPrisma.taxRule.create).toHaveBeenCalled()
  })

  it('updateTaxRule throws when not found', async () => {
    mockPrisma.taxRule.findUnique.mockResolvedValue(null)
    await expect(service.updateTaxRule('not-found', {} as any)).rejects.toThrow()
  })

  it('deleteTaxRule returns success', async () => {
    mockPrisma.taxRule.findUnique.mockResolvedValue({ id: 'r1' })
    mockPrisma.taxRule.delete.mockResolvedValue({})

    const res = await service.deleteTaxRule('r1')
    expect(res).toEqual({ success: true })
  })
})
