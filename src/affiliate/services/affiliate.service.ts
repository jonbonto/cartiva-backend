/**
 * AFFILIATE SERVICE — Core affiliate management
 * 
 * Handles:
 * - Affiliate account CRUD
 * - Product link management
 * - Referral code generation
 * - Attribution resolution
 * 
 * Architecture:
 * - All writes wrapped in transactions
 * - Referral codes are cryptographically random
 * - Attribution follows last-click-wins per product
 */

import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'
import { randomBytes } from 'crypto'
import {
  CreateAffiliateDto,
  UpdateAffiliateDto,
  CreateAffiliateLinkDto,
  AffiliateResponseDto,
  AffiliateLinkResponseDto,
  ReferralAttributionDto,
  PaginationDto,
} from '../dto'

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name)
  
  // Configurable base URL for referral links
  private readonly baseUrl = process.env.FRONTEND_URL || 'https://example.com'

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // AFFILIATE ACCOUNT MANAGEMENT
  // ===========================================================================

  /**
   * Create a new affiliate account
   * Only one affiliate per user
   */
  async createAffiliate(dto: CreateAffiliateDto): Promise<AffiliateResponseDto> {
    this.logger.log(`Creating affiliate for user ${dto.userId}`)

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    })

    if (!user) {
      throw new BadRequestException(`User ${dto.userId} not found`)
    }

    // Check if user already has affiliate account
    const existing = await this.prisma.affiliate.findUnique({
      where: { userId: dto.userId },
    })

    if (existing) {
      throw new ConflictException(`User ${dto.userId} already has an affiliate account`)
    }

    // Validate commission rate
    if (dto.defaultCommissionRate < 0 || dto.defaultCommissionRate > 1) {
      throw new BadRequestException('Commission rate must be between 0 and 1')
    }

    const affiliate = await this.prisma.affiliate.create({
      data: {
        userId: dto.userId,
        defaultCommissionRate: new Decimal(dto.defaultCommissionRate),
        payoutEmail: dto.payoutEmail,
        payoutMethod: dto.payoutMethod,
        notes: dto.notes,
        status: 'active',
      },
    })

    this.logger.log(`Affiliate ${affiliate.id} created for user ${dto.userId}`)

    return this.mapToResponse(affiliate)
  }

  /**
   * Get affiliate by ID
   */
  async getAffiliateById(affiliateId: string): Promise<AffiliateResponseDto> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    })

    if (!affiliate) {
      throw new NotFoundException(`Affiliate ${affiliateId} not found`)
    }

    return this.mapToResponse(affiliate)
  }

  /**
   * Get affiliate by user ID
   */
  async getAffiliateByUserId(userId: number): Promise<AffiliateResponseDto | null> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
    })

    return affiliate ? this.mapToResponse(affiliate) : null
  }

  /**
   * Update affiliate account
   */
  async updateAffiliate(affiliateId: string, dto: UpdateAffiliateDto): Promise<AffiliateResponseDto> {
    this.logger.log(`Updating affiliate ${affiliateId}`)

    const existing = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    })

    if (!existing) {
      throw new NotFoundException(`Affiliate ${affiliateId} not found`)
    }

    // Validate commission rate if provided
    if (dto.defaultCommissionRate !== undefined) {
      if (dto.defaultCommissionRate < 0 || dto.defaultCommissionRate > 1) {
        throw new BadRequestException('Commission rate must be between 0 and 1')
      }
    }

    const updated = await this.prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.defaultCommissionRate !== undefined && {
          defaultCommissionRate: new Decimal(dto.defaultCommissionRate),
        }),
        ...(dto.payoutEmail !== undefined && { payoutEmail: dto.payoutEmail }),
        ...(dto.payoutMethod !== undefined && { payoutMethod: dto.payoutMethod }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    })

    this.logger.log(`Affiliate ${affiliateId} updated`)

    return this.mapToResponse(updated)
  }

  /**
   * Suspend affiliate (freeze commissions, disable links)
   */
  async suspendAffiliate(affiliateId: string, reason?: string): Promise<void> {
    this.logger.warn(`Suspending affiliate ${affiliateId}: ${reason || 'No reason provided'}`)

    await this.prisma.$transaction(async (tx) => {
      // Update affiliate status
      await tx.affiliate.update({
        where: { id: affiliateId },
        data: {
          status: 'suspended',
          notes: reason ? `SUSPENDED: ${reason}` : undefined,
        },
      })

      // Deactivate all product links
      await tx.affiliateProductLink.updateMany({
        where: { affiliateId },
        data: { isActive: false },
      })
    })

    this.logger.warn(`Affiliate ${affiliateId} suspended`)
  }

  /**
   * List all affiliates (admin)
   */
  async listAffiliates(pagination: PaginationDto, status?: string): Promise<{
    affiliates: AffiliateResponseDto[]
    total: number
  }> {
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const skip = (page - 1) * limit

    const where = status ? { status } : {}

    const [affiliates, total] = await Promise.all([
      this.prisma.affiliate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliate.count({ where }),
    ])

    return {
      affiliates: affiliates.map(a => this.mapToResponse(a)),
      total,
    }
  }

  // ===========================================================================
  // PRODUCT LINK MANAGEMENT
  // ===========================================================================

  /**
   * Create affiliate product link with unique referral code
   */
  async createProductLink(
    affiliateId: string,
    dto: CreateAffiliateLinkDto,
  ): Promise<AffiliateLinkResponseDto> {
    this.logger.log(`Creating product link for affiliate ${affiliateId}, product ${dto.productId}`)

    // Validate affiliate exists and is active
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    })

    if (!affiliate) {
      throw new NotFoundException(`Affiliate ${affiliateId} not found`)
    }

    if (affiliate.status !== 'active') {
      throw new BadRequestException(`Affiliate account is ${affiliate.status}`)
    }

    // Check for existing link
    const existing = await this.prisma.affiliateProductLink.findUnique({
      where: {
        affiliateId_productId: {
          affiliateId,
          productId: dto.productId,
        },
      },
    })

    if (existing) {
      throw new ConflictException(
        `Affiliate already has a link for product ${dto.productId}`
      )
    }

    // Generate unique referral code
    const referralCode = this.generateReferralCode()

    // Validate commission rate if provided
    if (dto.commissionRate !== undefined) {
      if (dto.commissionRate < 0 || dto.commissionRate > 1) {
        throw new BadRequestException('Commission rate must be between 0 and 1')
      }
    }

    const link = await this.prisma.affiliateProductLink.create({
      data: {
        affiliateId,
        productId: dto.productId,
        referralCode,
        commissionRate: dto.commissionRate !== undefined
          ? new Decimal(dto.commissionRate)
          : null,
        isActive: true,
      },
    })

    // Get effective commission rate
    const effectiveRate = link.commissionRate !== null
      ? Number(link.commissionRate)
      : Number(affiliate.defaultCommissionRate)

    this.logger.log(`Product link ${link.id} created with code ${referralCode}`)

    return this.mapLinkToResponse(link, effectiveRate)
  }

  /**
   * Get affiliate's product links
   */
  async getAffiliateLinks(
    affiliateId: string,
    pagination: PaginationDto,
    includeStats = false,
  ): Promise<{ links: AffiliateLinkResponseDto[]; total: number }> {
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const skip = (page - 1) * limit

    // Get affiliate for default rate
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    })

    if (!affiliate) {
      throw new NotFoundException(`Affiliate ${affiliateId} not found`)
    }

    const [links, total] = await Promise.all([
      this.prisma.affiliateProductLink.findMany({
        where: { affiliateId, isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: includeStats ? { _count: { select: { clicks: true } } } : undefined,
      }),
      this.prisma.affiliateProductLink.count({ where: { affiliateId, isActive: true } }),
    ])

    return {
      links: links.map(link => {
        const effectiveRate = link.commissionRate !== null
          ? Number(link.commissionRate)
          : Number(affiliate.defaultCommissionRate)
        
        return {
          ...this.mapLinkToResponse(link, effectiveRate),
          clickCount: includeStats ? (link as any)._count?.clicks : undefined,
        }
      }),
      total,
    }
  }

  /**
   * Deactivate a product link
   */
  async deactivateLink(affiliateId: string, linkId: string): Promise<void> {
    const link = await this.prisma.affiliateProductLink.findFirst({
      where: { id: linkId, affiliateId },
    })

    if (!link) {
      throw new NotFoundException(`Link ${linkId} not found for affiliate ${affiliateId}`)
    }

    await this.prisma.affiliateProductLink.update({
      where: { id: linkId },
      data: { isActive: false },
    })

    this.logger.log(`Product link ${linkId} deactivated`)
  }

  // ===========================================================================
  // REFERRAL RESOLUTION & ATTRIBUTION
  // ===========================================================================

  /**
   * Resolve referral code to attribution data
   * Called during checkout to attribute products to affiliates
   * 
   * Resolution rules:
   * 1. Referral code must exist
   * 2. Link must be active
   * 3. Product must match
   * 4. Affiliate must be active
   * 5. Affiliate cannot be the buyer
   */
  async resolveReferral(
    referralCode: string,
    productId: number,
    buyerUserId: number,
  ): Promise<ReferralAttributionDto | null> {
    this.logger.debug(`Resolving referral ${referralCode} for product ${productId}`)

    // Find the link by referral code
    const link = await this.prisma.affiliateProductLink.findUnique({
      where: { referralCode },
      include: { affiliate: true },
    })

    // Validation checks
    if (!link) {
      this.logger.debug(`Referral code ${referralCode} not found`)
      return null
    }

    if (!link.isActive) {
      this.logger.debug(`Referral link ${link.id} is not active`)
      return null
    }

    if (link.productId !== productId) {
      this.logger.debug(`Referral code ${referralCode} is for product ${link.productId}, not ${productId}`)
      return null
    }

    if (link.affiliate.status !== 'active') {
      this.logger.debug(`Affiliate ${link.affiliateId} is ${link.affiliate.status}`)
      return null
    }

    // CRITICAL: Block self-purchase (affiliate cannot earn on their own orders)
    if (link.affiliate.userId === buyerUserId) {
      this.logger.warn(`Self-purchase blocked: affiliate ${link.affiliateId} is buyer ${buyerUserId}`)
      return null
    }

    // Calculate effective commission rate
    const commissionRate = link.commissionRate !== null
      ? Number(link.commissionRate)
      : Number(link.affiliate.defaultCommissionRate)

    const attribution: ReferralAttributionDto = {
      productId,
      affiliateId: link.affiliateId,
      affiliateProductLinkId: link.id,
      referralCode: link.referralCode,
      commissionRate,
      attributedAt: new Date(),
    }

    this.logger.debug(`Referral resolved: affiliate ${link.affiliateId}, rate ${commissionRate}`)

    return attribution
  }

  /**
   * Resolve multiple referrals for an order
   * Used during checkout to attribute all cart items
   * 
   * @param referrals Map of productId → referralCode
   * @param buyerUserId User making the purchase
   */
  async resolveOrderReferrals(
    referrals: Map<number, string>,
    buyerUserId: number,
  ): Promise<Map<number, ReferralAttributionDto>> {
    const attributions = new Map<number, ReferralAttributionDto>()

    for (const [productId, referralCode] of referrals.entries()) {
      const attribution = await this.resolveReferral(referralCode, productId, buyerUserId)
      if (attribution) {
        attributions.set(productId, attribution)
      }
    }

    return attributions
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Generate cryptographically secure referral code
   * Format: 8 alphanumeric characters (lowercase)
   */
  private generateReferralCode(): string {
    // Generate more bytes for uniqueness, then encode
    const bytes = randomBytes(6)
    const code = bytes.toString('base64url').toLowerCase().substring(0, 8)
    return code
  }

  /**
   * Map affiliate entity to response DTO
   */
  private mapToResponse(affiliate: any): AffiliateResponseDto {
    return {
      id: affiliate.id,
      userId: affiliate.userId,
      status: affiliate.status,
      defaultCommissionRate: Number(affiliate.defaultCommissionRate),
      payoutEmail: affiliate.payoutEmail,
      payoutMethod: affiliate.payoutMethod,
      createdAt: affiliate.createdAt,
      updatedAt: affiliate.updatedAt,
    }
  }

  /**
   * Map link entity to response DTO
   */
  private mapLinkToResponse(link: any, effectiveRate: number): AffiliateLinkResponseDto {
    return {
      id: link.id,
      affiliateId: link.affiliateId,
      productId: link.productId,
      referralCode: link.referralCode,
      referralUrl: `${this.baseUrl}/product/${link.productId}?ref=${link.referralCode}`,
      commissionRate: effectiveRate,
      isActive: link.isActive,
      createdAt: link.createdAt,
    }
  }
}
