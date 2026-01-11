import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { AuditLogService } from '../audit/audit-log.service'

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService
  ) {}

  /**
   * Get all active products (soft-delete aware)
   */
  findAll(includeInactive = false) {
    const where: any = {}
    if (!includeInactive) {
      where.isActive = true
    }
    return this.prisma.product.findMany({ where })
  }

  /**
   * Get product by ID — visible even if soft-deleted
   * (needed for audit trail and history)
   */
  findOne(id: number) {
    return this.prisma.product.findUnique({ where: { id } })
  }

  /**
   * Create product with audit logging
   */
  async create(dto: CreateProductDto, adminId: number, ipAddress?: string, userAgent?: string) {
    const product = await this.prisma.product.create({ data: dto })

    // Log audit entry
    await this.auditLog.log({
      adminId,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      beforeState: null,
      afterState: product,
      ipAddress,
      userAgent,
    })

    return product
  }

  /**
   * Update product with audit logging
   */
  async update(
    id: number,
    dto: UpdateProductDto,
    adminId: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const before = await this.prisma.product.findUnique({ where: { id } })

    const after = await this.prisma.product.update({ where: { id }, data: dto })

    // Log audit entry
    await this.auditLog.log({
      adminId,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      beforeState: before,
      afterState: after,
      ipAddress,
      userAgent,
    })

    return after
  }

  /**
   * PHASE 2: Soft delete — mark product as inactive instead of hard delete
   * Product remains in database for historical reference
   */
  async deactivate(id: number, adminId: number, ipAddress?: string, userAgent?: string) {
    const before = await this.prisma.product.findUnique({ where: { id } })

    const after = await this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    })

    // Log audit entry
    await this.auditLog.log({
      adminId,
      action: 'DEACTIVATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      beforeState: before,
      afterState: after,
      ipAddress,
      userAgent,
    })

    return after
  }

  /**
   * DEPRECATED: Hard delete removed
   * Use deactivate() instead
   */
  remove(id: number) {
    throw new Error('Hard delete not allowed. Use deactivate() instead.')
  }
}
