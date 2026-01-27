import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface ApplyForAffiliateDto {
  email: string
  payoutMethod?: string
  payoutDetails?: Record<string, any>
  notes?: string
}

export interface ApproveApplicationDto {
  defaultCommissionRate: number
  payoutMethod?: string
  payoutDetails?: Record<string, any>
  adminNotes?: string
}

export interface RejectApplicationDto {
  adminNotes: string
}

/**
 * Affiliate Application Service
 * 
 * Handles affiliate program applications:
 * - User applies to become affiliate
 * - Admin reviews and approves/rejects
 * - Approved applications create Affiliate account
 */
@Injectable()
export class AffiliateApplicationService {
  private readonly logger = new Logger(AffiliateApplicationService.name)

  constructor(private prisma: PrismaService) {}

  /**
   * Apply for affiliate program
   * 
   * @param userId User ID applying
   * @param dto Application details
   * @returns Created application
   */
  async applyForAffiliate(userId: number, dto: ApplyForAffiliateDto) {
    // Check if user already has an affiliate account
    const existingAffiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
    })

    if (existingAffiliate) {
      throw new BadRequestException('User already has an affiliate account')
    }

    // Check if user already has an application record
    const existingApplication = await this.prisma.affiliateApplication.findUnique({
      where: { userId },
    })

    if (existingApplication) {
      if (existingApplication.status === 'pending') {
        throw new BadRequestException('User already has a pending application')
      }

      if (existingApplication.status === 'approved' || existingApplication.status === 'active' || existingApplication.status === 'approved') {
        // defensive: do not allow re-apply if user was already approved
        throw new BadRequestException('User already has an affiliate account or approved application')
      }

      // If application was rejected, allow re-application by updating the existing record
      if (existingApplication.status === 'rejected') {
        const updated = await this.prisma.affiliateApplication.update({
          where: { id: existingApplication.id },
          data: {
            email: dto.email,
            payoutMethod: dto.payoutMethod,
            payoutDetails: dto.payoutDetails || null,
            notes: dto.notes || null,
            status: 'pending',
            // clear previous review metadata
            adminNotes: null,
            reviewedBy: null,
            reviewedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })

        this.logger.log(`Re-applied: application updated for user ${userId}`)
        return updated
      }
    }

    // No existing application — create a new one
    const application = await this.prisma.affiliateApplication.create({
      data: {
        userId,
        email: dto.email,
        payoutMethod: dto.payoutMethod,
        payoutDetails: dto.payoutDetails || null,
        notes: dto.notes || null,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    this.logger.log(`Application created for user ${userId}`)
    return application
  }

  /**
   * Get user's application status
   * 
   * @param userId User ID
   * @returns Application or null
   */
  async getApplicationByUserId(userId: number) {
    return this.prisma.affiliateApplication.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  }

  /**
   * List applications with filters
   * 
   * @param filters Status, page, limit
   * @returns Paginated list
   */
  async listApplications(filters: {
    status?: string
    page?: number
    limit?: number
  } = {}) {
    const { status, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) {
      where.status = status
    }

    const [applications, total] = await Promise.all([
      this.prisma.affiliateApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliateApplication.count({ where }),
    ])

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Approve application and create affiliate account
   * 
   * @param applicationId Application ID
   * @param dto Approval details (commission rate, payout info)
   * @param adminId Admin user ID
   * @returns Newly created affiliate
   */
  async approveApplication(
    applicationId: string,
    dto: ApproveApplicationDto,
    adminId: number
  ) {
    // Get application
    const application = await this.prisma.affiliateApplication.findUnique({
      where: { id: applicationId },
    })

    if (!application) {
      throw new BadRequestException('Application not found')
    }

    if (application.status !== 'pending') {
      throw new BadRequestException(`Cannot approve application with status: ${application.status}`)
    }

    // Check user doesn't already have affiliate account
    const existingAffiliate = await this.prisma.affiliate.findUnique({
      where: { userId: application.userId },
    })

    if (existingAffiliate) {
      throw new BadRequestException('User already has an affiliate account')
    }

    // Create affiliate account and update application in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create affiliate
      const affiliate = await tx.affiliate.create({
        data: {
          userId: application.userId,
          status: 'active',
          defaultCommissionRate: dto.defaultCommissionRate,
          payoutEmail: application.email,
          payoutMethod: dto.payoutMethod || application.payoutMethod,
          payoutDetails: dto.payoutDetails || application.payoutDetails,
        },
      })

      // Update application
      await tx.affiliateApplication.update({
        where: { id: applicationId },
        data: {
          status: 'approved',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          adminNotes: dto.adminNotes || null,
        },
      })

      return affiliate
    })

    this.logger.log(`Application ${applicationId} approved. Affiliate created: ${result.id}`)
    return result
  }

  /**
   * Reject application
   * 
   * @param applicationId Application ID
   * @param dto Rejection details
   * @param adminId Admin user ID
   * @returns Updated application
   */
  async rejectApplication(
    applicationId: string,
    dto: RejectApplicationDto,
    adminId: number
  ) {
    const application = await this.prisma.affiliateApplication.findUnique({
      where: { id: applicationId },
    })

    if (!application) {
      throw new BadRequestException('Application not found')
    }

    if (application.status !== 'pending') {
      throw new BadRequestException(`Cannot reject application with status: ${application.status}`)
    }

    const updated = await this.prisma.affiliateApplication.update({
      where: { id: applicationId },
      data: {
        status: 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: dto.adminNotes,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    this.logger.log(`Application ${applicationId} rejected`)
    return updated
  }
}
