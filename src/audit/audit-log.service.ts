import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface AuditLogEntry {
  adminId: number
  action: 'CREATE_PRODUCT' | 'UPDATE_PRODUCT' | 'DEACTIVATE_PRODUCT'
  entityType: 'PRODUCT'
  entityId: number
  beforeState?: any
  afterState: any
  ipAddress?: string
  userAgent?: string
}

/**
 * Audit logging service — immutable trail of admin actions
 *
 * PHASE 2: Traceability
 * - All admin mutations logged transactionally
 * - Before/after state captures for forensics
 * - Never fails silently
 */
@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          adminId: entry.adminId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          beforeState: entry.beforeState || null,
          afterState: entry.afterState,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      })
    } catch (error) {
      // CRITICAL: Audit logging failure must be visible
      console.error('AUDIT LOG FAILURE:', {
        action: entry.action,
        entityId: entry.entityId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
