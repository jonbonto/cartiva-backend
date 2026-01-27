/**
 * AFFILIATE CONTROLLER — API endpoints for affiliate system
 * 
 * Endpoints:
 * 
 * PUBLIC:
 * - POST /api/affiliate/track - Track referral click
 * 
 * AUTHENTICATED (Affiliate):
 * - GET  /api/affiliate/profile - Get own affiliate profile
 * - GET  /api/affiliate/links - Get own referral links
 * - POST /api/affiliate/links - Create referral link
 * - DELETE /api/affiliate/links/:id - Deactivate referral link
 * - GET  /api/affiliate/stats - Get earnings statistics
 * - GET  /api/affiliate/commissions - Get commission history
 * - GET  /api/affiliate/payouts - Get payout history
 * 
 * ADMIN:
 * - GET  /api/admin/affiliates - List all affiliates
 * - GET  /api/admin/affiliates/:id - Get affiliate details
 * - POST /api/admin/affiliates - Create affiliate account
 * - PATCH /api/admin/affiliates/:id - Update affiliate
 * - POST /api/admin/affiliates/:id/suspend - Suspend affiliate
 * - GET  /api/admin/affiliate/commissions - List all commissions
 * - POST /api/admin/affiliate/payout - Process payout
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  ForbiddenException,
  Headers,
  Ip,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { AffiliateService } from './services/affiliate.service'
import { AffiliateTrackingService } from './services/affiliate-tracking.service'
import { AffiliateCommissionService } from './services/affiliate-commission.service'
import {
  TrackClickDto,
  CreateAffiliateLinkDto,
  CreateAffiliateDto,
  UpdateAffiliateDto,
  ProcessPayoutDto,
  CommissionFilterDto,
  PaginationDto,
  DateRangeDto,
} from './dto'

// =============================================================================
// PUBLIC CONTROLLER
// =============================================================================

@Controller('api/affiliate')
export class AffiliatePublicController {
  private readonly logger = new Logger(AffiliatePublicController.name)

  constructor(
    private readonly trackingService: AffiliateTrackingService,
  ) {}

  /**
   * POST /api/affiliate/track
   * Track a referral link click
   * 
   * Public endpoint - no auth required
   * Rate limited by IP
   */
  @Post('track')
  @HttpCode(HttpStatus.OK)
  async trackClick(
    @Body() dto: TrackClickDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referer?: string,
  ) {
    // Enrich DTO with request metadata
    const enrichedDto: TrackClickDto = {
      ...dto,
      ipAddress: dto.ipAddress || ip,
      userAgent: dto.userAgent || userAgent,
      referer: dto.referer || referer,
    }

    this.logger.debug(`Click track request: ${dto.referralCode} for product ${dto.productId}`)

    return this.trackingService.trackClick(enrichedDto)
  }
}

// =============================================================================
// AUTHENTICATED AFFILIATE CONTROLLER
// =============================================================================

@Controller('api/affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  private readonly logger = new Logger(AffiliateController.name)

  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly trackingService: AffiliateTrackingService,
    private readonly commissionService: AffiliateCommissionService,
  ) {}

  /**
   * Ensure current user is an active affiliate
   */
  private async getAffiliateIdForUser(userId: number): Promise<string> {
    const affiliate = await this.affiliateService.getAffiliateByUserId(userId)
    if (!affiliate) {
      throw new ForbiddenException('You are not registered as an affiliate')
    }
    if (affiliate.status !== 'active') {
      throw new ForbiddenException(`Your affiliate account is ${affiliate.status}`)
    }
    return affiliate.id
  }

  /**
   * GET /api/affiliate/profile
   * Get own affiliate profile
   */
  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = req.user?.id
    if (!userId) {
      throw new BadRequestException('User ID not found')
    }

    const affiliate = await this.affiliateService.getAffiliateByUserId(userId)
    if (!affiliate) {
      throw new ForbiddenException('You are not registered as an affiliate')
    }

    return affiliate
  }

  /**
   * GET /api/affiliate/links
   * Get own referral links
   */
  @Get('links')
  async getLinks(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    const pagination: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    }

    const result = await this.affiliateService.getAffiliateLinks(
      affiliateId,
      pagination,
      true, // Include click stats
    )

    return {
      data: result.links,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / (pagination.limit || 20)),
      },
    }
  }

  /**
   * POST /api/affiliate/links
   * Create a new referral link for a product
   */
  @Post('links')
  async createLink(
    @Request() req: any,
    @Body() dto: CreateAffiliateLinkDto,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    return this.affiliateService.createProductLink(affiliateId, dto)
  }

  /**
   * DELETE /api/affiliate/links/:id
   * Deactivate a referral link
   */
  @Delete('links/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateLink(
    @Request() req: any,
    @Param('id') linkId: string,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    await this.affiliateService.deactivateLink(affiliateId, linkId)
  }

  /**
   * GET /api/affiliate/stats
   * Get earnings statistics
   */
  @Get('stats')
  async getStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    return this.commissionService.getAffiliateStats(
      affiliateId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    )
  }

  /**
   * GET /api/affiliate/commissions
   * Get commission history
   */
  @Get('commissions')
  async getCommissions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    const filters: CommissionFilterDto = {
      affiliateId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: status as any,
      startDate,
      endDate,
    }

    const result = await this.commissionService.listCommissions(filters)

    return {
      data: result.commissions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / (filters.limit || 20)),
      },
    }
  }

  /**
   * GET /api/affiliate/payouts
   * Get payout history
   */
  @Get('payouts')
  async getPayouts(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    const result = await this.commissionService.getPayoutBatches(
      affiliateId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )

    return {
      data: result.batches,
      pagination: {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (limit ? parseInt(limit, 10) : 20)),
      },
    }
  }

  /**
   * GET /api/affiliate/clicks
   * Get click history (analytics)
   */
  @Get('clicks')
  async getClicks(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const affiliateId = await this.getAffiliateIdForUser(req.user?.id)

    const pagination: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    }

    const dateRange: DateRangeDto = {
      startDate,
      endDate,
    }

    const result = await this.trackingService.getClicksForAffiliate(
      affiliateId,
      pagination,
      dateRange,
    )

    return {
      data: result.clicks,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / (pagination.limit || 50)),
      },
    }
  }
}

// =============================================================================
// ADMIN CONTROLLER
// =============================================================================

@Controller('api/admin/affiliate')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AffiliateAdminController {
  private readonly logger = new Logger(AffiliateAdminController.name)

  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly commissionService: AffiliateCommissionService,
  ) {}

  /**
   * GET /api/admin/affiliate/affiliates
   * List all affiliates
   */
  @Get('affiliates')
  async listAffiliates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pagination: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    }

    const result = await this.affiliateService.listAffiliates(pagination, status)

    return {
      data: result.affiliates,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / (pagination.limit || 20)),
      },
    }
  }

  /**
   * GET /api/admin/affiliate/affiliates/:id
   * Get affiliate details
   */
  @Get('affiliates/:id')
  async getAffiliate(@Param('id') id: string) {
    return this.affiliateService.getAffiliateById(id)
  }

  /**
   * POST /api/admin/affiliate/affiliates
   * Create affiliate account for a user
   */
  @Post('affiliates')
  async createAffiliate(@Body() dto: CreateAffiliateDto) {
    return this.affiliateService.createAffiliate(dto)
  }

  /**
   * PATCH /api/admin/affiliate/affiliates/:id
   * Update affiliate account
   */
  @Patch('affiliates/:id')
  async updateAffiliate(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateDto,
  ) {
    return this.affiliateService.updateAffiliate(id, dto)
  }

  /**
   * POST /api/admin/affiliate/affiliates/:id/suspend
   * Suspend affiliate account
   */
  @Post('affiliates/:id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspendAffiliate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    await this.affiliateService.suspendAffiliate(id, body.reason)
  }

  /**
   * GET /api/admin/affiliate/commissions
   * List all commissions with filtering
   */
  @Get('commissions')
  async listCommissions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('affiliateId') affiliateId?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: CommissionFilterDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      affiliateId,
      status: status as any,
      orderId,
      productId: productId ? parseInt(productId, 10) : undefined,
      startDate,
      endDate,
    }

    const result = await this.commissionService.listCommissions(filters)

    return {
      data: result.commissions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / (filters.limit || 20)),
      },
    }
  }

  /**
   * POST /api/admin/affiliate/payout
   * Create payout batch for affiliate
   */
  @Post('payout')
  async createPayout(
    @Request() req: any,
    @Body() dto: ProcessPayoutDto,
  ) {
    const adminId = req.user?.id

    return this.commissionService.createPayoutBatch(dto, adminId)
  }

  /**
   * POST /api/admin/affiliate/payout/:batchId/mark-paid
   * Mark payout batch as paid (manual confirmation)
   */
  @Post('payout/:batchId/mark-paid')
  async markPayoutPaid(
    @Param('batchId') batchId: string,
    @Body() body: { paymentReference: string },
  ) {
    return this.commissionService.markPayoutAsPaid(batchId, body.paymentReference)
  }

  /**
   * POST /api/admin/affiliate/payout/:batchId/mark-failed
   * Mark payout batch as failed
   */
  @Post('payout/:batchId/mark-failed')
  async markPayoutFailed(
    @Param('batchId') batchId: string,
    @Body() body: { reason: string },
  ) {
    return this.commissionService.markPayoutAsFailed(batchId, body.reason)
  }

  /**
   * GET /api/admin/affiliate/stats
   * Get overall affiliate program stats
   */
  @Get('stats')
  async getProgramStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Get aggregate stats across all affiliates
    // This would be a custom query in production
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    // For now, return basic counts
    const [totalAffiliates, activeAffiliates, totalCommissions, pendingCommissions] =
      await Promise.all([
        this.affiliateService['prisma'].affiliate.count(),
        this.affiliateService['prisma'].affiliate.count({ where: { status: 'active' } }),
        this.affiliateService['prisma'].affiliateCommission.count(),
        this.affiliateService['prisma'].affiliateCommission.count({
          where: { status: 'pending' },
        }),
      ])

    return {
      totalAffiliates,
      activeAffiliates,
      totalCommissions,
      pendingCommissions,
    }
  }
}
