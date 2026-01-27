/**
 * AFFILIATE SYSTEM DTOs — Product-Level Affiliate Program
 * 
 * All DTOs for affiliate-related API requests and responses.
 * Designed for type safety, validation, and clear API contracts.
 */

// =============================================================================
// REQUEST DTOs
// =============================================================================

/**
 * Track affiliate click request
 * POST /api/affiliate/track
 */
export interface TrackClickDto {
  referralCode: string
  productId: number
  sessionId: string
  ipAddress?: string
  userAgent?: string
  referer?: string
}

/**
 * Create affiliate product link request
 * POST /api/affiliate/links
 */
export interface CreateAffiliateLinkDto {
  productId: number
  commissionRate?: number // Optional override (0.00-1.00)
}

/**
 * Admin: Create affiliate account
 * POST /api/admin/affiliates
 */
export interface CreateAffiliateDto {
  userId: number
  defaultCommissionRate: number // 0.00-1.00
  payoutEmail?: string
  payoutMethod?: string
  notes?: string
}

/**
 * Admin: Update affiliate account
 * PATCH /api/admin/affiliates/:id
 */
export interface UpdateAffiliateDto {
  status?: 'active' | 'suspended' | 'pending_review'
  defaultCommissionRate?: number
  payoutEmail?: string
  payoutMethod?: string
  notes?: string
}

/**
 * Admin: Process payout
 * POST /api/admin/affiliate/payout
 */
export interface ProcessPayoutDto {
  affiliateId: string
  commissionIds?: string[] // Specific commissions to include, or all approved if empty
  paymentMethod: string
}

/**
 * Pagination params
 */
export interface PaginationDto {
  page?: number
  limit?: number
}

/**
 * Date range filter
 */
export interface DateRangeDto {
  startDate?: string // ISO date string
  endDate?: string   // ISO date string
}

/**
 * Commission filter params
 * GET /api/admin/affiliate/commissions
 */
export interface CommissionFilterDto extends PaginationDto, DateRangeDto {
  affiliateId?: string
  status?: 'pending' | 'approved' | 'cancelled' | 'paid'
  orderId?: string
  productId?: number
}

// =============================================================================
// RESPONSE DTOs
// =============================================================================

/**
 * Affiliate profile response
 */
export interface AffiliateResponseDto {
  id: string
  userId: number
  status: string
  defaultCommissionRate: number
  payoutEmail?: string
  payoutMethod?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Affiliate product link response
 */
export interface AffiliateLinkResponseDto {
  id: string
  affiliateId: string
  productId: number
  referralCode: string
  referralUrl: string // Full URL for sharing
  commissionRate: number // Effective rate (override or default)
  isActive: boolean
  createdAt: Date
  clickCount?: number // Optional: include click stats
}

/**
 * Affiliate click response (for analytics)
 */
export interface AffiliateClickResponseDto {
  id: string
  affiliateProductLinkId: string
  sessionId: string
  ipAddress?: string
  userAgent?: string
  referer?: string
  createdAt: Date
}

/**
 * Commission response
 */
export interface CommissionResponseDto {
  id: string
  affiliateId: string
  orderId: string
  orderItemId: string
  productId: number
  baseAmountCents: number
  commissionRate: number
  amountCents: number
  currency: string
  status: string
  approvedAt?: Date
  cancelledAt?: Date
  paidAt?: Date
  cancellationReason?: string
  createdAt: Date
}

/**
 * Affiliate stats response
 * GET /api/affiliate/stats
 */
export interface AffiliateStatsResponseDto {
  totalClicks: number
  totalConversions: number
  conversionRate: number // clicks → orders
  
  // Earnings breakdown
  pendingEarningsCents: number
  approvedEarningsCents: number
  paidEarningsCents: number
  cancelledEarningsCents: number
  totalEarningsCents: number
  
  currency: string
  
  // Period stats (optional)
  periodStart?: Date
  periodEnd?: Date
  
  // Top products (optional)
  topProducts?: Array<{
    productId: number
    productName?: string
    clicks: number
    conversions: number
    earningsCents: number
  }>
}

/**
 * Payout batch response
 */
export interface PayoutBatchResponseDto {
  id: string
  affiliateId: string
  totalAmountCents: number
  currency: string
  commissionCount: number
  status: string
  paymentMethod?: string
  paymentReference?: string
  processedAt?: Date
  paidAt?: Date
  createdAt: Date
}

/**
 * Track click response
 */
export interface TrackClickResponseDto {
  success: boolean
  message: string
  clickId?: string
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponseDto<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// =============================================================================
// INTERNAL DTOs (for service layer / jobs)
// =============================================================================

/**
 * Commission creation job data
 */
export interface CreateCommissionJobDto {
  affiliateId: string
  orderId: string
  orderItemId: string
  productId: number
  baseAmountCents: number
  commissionRate: number
  currency: string
  idempotencyKey: string
}

/**
 * Commission approval job data
 */
export interface ApproveCommissionJobDto {
  commissionId: string
  orderId: string
}

/**
 * Commission cancellation job data
 */
export interface CancelCommissionJobDto {
  commissionId?: string
  orderId?: string
  orderItemId?: string
  reason: string
  refundId?: string
}

/**
 * Referral attribution data (stored in checkout session)
 */
export interface ReferralAttributionDto {
  productId: number
  affiliateId: string
  affiliateProductLinkId: string
  referralCode: string
  commissionRate: number
  attributedAt: Date
}
