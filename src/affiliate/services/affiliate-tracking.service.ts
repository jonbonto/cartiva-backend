/**
 * AFFILIATE TRACKING SERVICE — Click tracking & analytics
 * 
 * Handles:
 * - Click recording (with deduplication)
 * - Rate limiting
 * - Anti-abuse measures
 * - Click analytics
 * 
 * Architecture:
 * - Deduplication by session + product link
 * - Rate limiting per IP
 * - Async processing via queue
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  TrackClickDto,
  TrackClickResponseDto,
  AffiliateClickResponseDto,
  PaginationDto,
  DateRangeDto,
} from '../dto'

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_CLICKS = 30 // Max clicks per IP per minute

@Injectable()
export class AffiliateTrackingService {
  private readonly logger = new Logger(AffiliateTrackingService.name)
  
  // In-memory rate limiting (should be Redis in production)
  private readonly rateLimitMap = new Map<string, { count: number; resetAt: number }>()

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // CLICK TRACKING
  // ===========================================================================

  /**
   * Track a referral link click
   * 
   * Deduplication:
   * - One click per session per link
   * 
   * Rate limiting:
   * - Max 30 clicks per minute per IP
   * 
   * Returns success even if deduplicated (for frontend simplicity)
   */
  async trackClick(dto: TrackClickDto): Promise<TrackClickResponseDto> {
    this.logger.debug(`Tracking click: ${dto.referralCode} for product ${dto.productId}`)

    // Rate limit check
    if (dto.ipAddress && !this.checkRateLimit(dto.ipAddress)) {
      this.logger.warn(`Rate limit exceeded for IP ${dto.ipAddress}`)
      // Return success to not reveal rate limiting to potential abusers
      return { success: true, message: 'Tracked' }
    }

    // Find the affiliate product link
    const link = await this.prisma.affiliateProductLink.findUnique({
      where: { referralCode: dto.referralCode },
      include: { affiliate: true },
    })

    if (!link) {
      this.logger.debug(`Referral code ${dto.referralCode} not found`)
      return { success: false, message: 'Invalid referral code' }
    }

    if (!link.isActive) {
      this.logger.debug(`Link ${link.id} is not active`)
      return { success: false, message: 'Referral link is not active' }
    }

    if (link.productId !== dto.productId) {
      this.logger.debug(`Product mismatch: expected ${link.productId}, got ${dto.productId}`)
      return { success: false, message: 'Product mismatch' }
    }

    if (link.affiliate.status !== 'active') {
      this.logger.debug(`Affiliate ${link.affiliateId} is ${link.affiliate.status}`)
      return { success: false, message: 'Affiliate is not active' }
    }

    // Attempt to create click (will fail on duplicate due to unique constraint)
    try {
      const click = await this.prisma.affiliateClick.create({
        data: {
          affiliateProductLinkId: link.id,
          sessionId: dto.sessionId,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          referer: dto.referer,
        },
      })

      this.logger.debug(`Click ${click.id} recorded for link ${link.id}`)

      return {
        success: true,
        message: 'Click tracked',
        clickId: click.id,
      }
    } catch (error: any) {
      // Handle unique constraint violation (duplicate click)
      if (error.code === 'P2002') {
        this.logger.debug(`Duplicate click for session ${dto.sessionId} on link ${link.id}`)
        return { success: true, message: 'Already tracked' }
      }

      this.logger.error(`Error tracking click: ${error.message}`)
      throw error
    }
  }

  /**
   * Get clicks for an affiliate's links (analytics)
   */
  async getClicksForAffiliate(
    affiliateId: string,
    pagination: PaginationDto,
    dateRange?: DateRangeDto,
  ): Promise<{ clicks: AffiliateClickResponseDto[]; total: number }> {
    const page = pagination.page || 1
    const limit = pagination.limit || 50
    const skip = (page - 1) * limit

    // Build date filter
    const dateFilter: any = {}
    if (dateRange?.startDate) {
      dateFilter.gte = new Date(dateRange.startDate)
    }
    if (dateRange?.endDate) {
      dateFilter.lte = new Date(dateRange.endDate)
    }

    const where: any = {
      affiliateProductLink: { affiliateId },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    }

    const [clicks, total] = await Promise.all([
      this.prisma.affiliateClick.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliateClick.count({ where }),
    ])

    return {
      clicks: clicks.map(this.mapClickToResponse),
      total,
    }
  }

  /**
   * Get click count summary for a link
   */
  async getClickCountForLink(linkId: string): Promise<number> {
    return this.prisma.affiliateClick.count({
      where: { affiliateProductLinkId: linkId },
    })
  }

  /**
   * Get click count by date range
   */
  async getClickCountByDateRange(
    affiliateId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.prisma.affiliateClick.count({
      where: {
        affiliateProductLink: { affiliateId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
  }

  /**
   * Get unique visitor count (by session)
   */
  async getUniqueVisitorCount(
    affiliateId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate

    const result = await this.prisma.affiliateClick.groupBy({
      by: ['sessionId'],
      where: {
        affiliateProductLink: { affiliateId },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
    })

    return result.length
  }

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================

  /**
   * Check rate limit for an IP address
   * Returns true if request is allowed, false if rate limited
   */
  private checkRateLimit(ipAddress: string): boolean {
    const now = Date.now()
    const entry = this.rateLimitMap.get(ipAddress)

    if (!entry || now > entry.resetAt) {
      // New window
      this.rateLimitMap.set(ipAddress, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      })
      return true
    }

    if (entry.count >= RATE_LIMIT_MAX_CLICKS) {
      return false
    }

    entry.count++
    return true
  }

  /**
   * Clean up expired rate limit entries (call periodically)
   */
  cleanupRateLimits(): void {
    const now = Date.now()
    for (const [ip, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        this.rateLimitMap.delete(ip)
      }
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapClickToResponse(click: any): AffiliateClickResponseDto {
    return {
      id: click.id,
      affiliateProductLinkId: click.affiliateProductLinkId,
      sessionId: click.sessionId,
      ipAddress: click.ipAddress,
      userAgent: click.userAgent,
      referer: click.referer,
      createdAt: click.createdAt,
    }
  }
}
