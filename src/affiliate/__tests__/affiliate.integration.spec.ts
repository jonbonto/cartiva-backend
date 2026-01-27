import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import { AffiliateService } from '../services/affiliate.service'
import { AffiliateCommissionService } from '../services/affiliate-commission.service'
import { AffiliateTrackingService } from '../services/affiliate-tracking.service'
import { AffiliateOrderIntegrationService } from '../integration/affiliate-order-integration.service'
import { AffiliateModule } from '../affiliate.module'

/**
 * COMPREHENSIVE AFFILIATE INTEGRATION TEST
 * 
 * This test exercises the complete affiliate workflow:
 * 1. Create affiliate account
 * 2. Create product links
 * 3. Track clicks (with deduplication)
 * 4. Complete order with referral
 * 5. Verify commission created
 * 6. Fulfill order → commission approved
 * 7. Process refund → commission cancelled
 * 8. Create payout batch
 * 9. Mark payout as paid
 * 10. Verify self-purchase blocked
 * 11. Verify suspended affiliate blocked
 */
describe('Affiliate System - Complete Integration (e2e)', () => {
  let module: TestingModule
  let prisma: PrismaService
  let affiliateService: AffiliateService
  let commissionService: AffiliateCommissionService
  let trackingService: AffiliateTrackingService
  let integrationService: AffiliateOrderIntegrationService

  // Test data
  let affiliateUser: any
  let buyerUser: any
  let testProduct: any
  let productLink: any
  let testOrder: any
  let sessionId: string
  // Track created resource ids for scoped cleanup
  const createdUserIds: number[] = []
  const createdProductIds: number[] = []
  const createdOrderIds: string[] = []
  const createdAffiliateIds: string[] = []
  const createdLinkIds: string[] = []
  const createdPayoutBatchIds: string[] = []
  const sessionIds: string[] = []

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AffiliateModule],
    }).compile()

    prisma = module.get<PrismaService>(PrismaService)
    affiliateService = module.get<AffiliateService>(AffiliateService)
    commissionService = module.get<AffiliateCommissionService>(AffiliateCommissionService)
    trackingService = module.get<AffiliateTrackingService>(AffiliateTrackingService)
    integrationService = module.get<AffiliateOrderIntegrationService>(AffiliateOrderIntegrationService)

    // Setup: Create test users
    affiliateUser = await prisma.user.create({
      data: {
        name: 'Test Affiliate',
        email: 'affiliate@test.com',
        password: 'hashed_password',
        role: 'user',
      },
    })
    createdUserIds.push(affiliateUser.id)

    buyerUser = await prisma.user.create({
      data: {
        name: 'Test Buyer',
        email: 'buyer@test.com',
        password: 'hashed_password',
        role: 'user',
      },
    })
    createdUserIds.push(buyerUser.id)

    // Setup: Create test product
    testProduct = await prisma.product.create({
      data: {
        name: 'Awesome Widget',
        description: 'A wonderful product',
        priceInCents: 10000, // $100
        stock: 100,
        imageUrl: 'https://example.com/widget.jpg',
        isActive: true,
      },
    })

    createdProductIds.push(testProduct.id)

    sessionId = `session_${Date.now()}`
    sessionIds.push(sessionId)
  })

  afterAll(async () => {
    // Scoped cleanup: delete only records created by this test run
    try {
      if (createdLinkIds.length > 0) {
        await prisma.affiliateClick.deleteMany({ where: { affiliateProductLinkId: { in: createdLinkIds } } })
      }

      if (createdAffiliateIds.length > 0) {
        await prisma.affiliateCommission.deleteMany({ where: { affiliateId: { in: createdAffiliateIds } } })
      }

      if (createdPayoutBatchIds.length > 0) {
        await prisma.affiliatePayoutBatch.deleteMany({ where: { id: { in: createdPayoutBatchIds } } })
      }

      if (createdLinkIds.length > 0) {
        await prisma.affiliateProductLink.deleteMany({ where: { id: { in: createdLinkIds } } })
      }

      if (createdAffiliateIds.length > 0) {
        await prisma.affiliate.deleteMany({ where: { id: { in: createdAffiliateIds } } })
      }

      if (createdOrderIds.length > 0) {
        await prisma.itemRefund.deleteMany({ where: { refundId: { in: createdOrderIds } } }).catch(() => {})
        await prisma.refund.deleteMany({ where: { orderId: { in: createdOrderIds } } }).catch(() => {})
        await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } }).catch(() => {})
        await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } }).catch(() => {})
        await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
      }

      if (createdProductIds.length > 0) {
        await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
      }

      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
      }
    } finally {
      await module.close()
      // Ensure Prisma disconnect to avoid open handles
      try { await prisma.$disconnect() } catch (_) {}
    }
  })

  describe('✓ 1. Create affiliate account', () => {
    it('should create an affiliate account', async () => {
      const affiliate = await affiliateService.createAffiliate({
        userId: affiliateUser.id,
        defaultCommissionRate: 0.1, // 10%
        payoutEmail: 'payout@test.com',
        payoutMethod: 'paypal',
      })

      // Track affiliate id for cleanup
      createdAffiliateIds.push(affiliate.id)

      expect(affiliate).toBeDefined()
      expect(affiliate.userId).toBe(affiliateUser.id)
      expect(affiliate.status).toBe('active')
      expect(Number(affiliate.defaultCommissionRate)).toBe(0.1)

      console.log('✓ Affiliate created:', affiliate.id)
    })

    it('should retrieve affiliate by user ID', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      expect(affiliate).toBeDefined()
      expect(affiliate?.userId).toBe(affiliateUser.id)

      console.log('✓ Affiliate profile retrieved')
    })
  })

  describe('✓ 2. Create product links', () => {
    it('should create a referral link for a product', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      const link = await affiliateService.createProductLink(
        affiliate!.id,
        {
          productId: testProduct.id,
          commissionRate: 0.15, // 15% for this product
        }
      )

      // Track link id for cleanup
      createdLinkIds.push(link.id)

      expect(link).toBeDefined()
      expect(link.productId).toBe(testProduct.id)
      expect(link.isActive).toBe(true)
      expect(link.referralCode).toMatch(/^[a-z0-9]{8}$/)

      productLink = link

      console.log(`✓ Product link created: ${link.referralCode}`)
      console.log(`  Referral URL: ${link.referralUrl}`)
    })

    it('should list affiliate product links', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      const { links, total } = await affiliateService.getAffiliateLinks(affiliate!.id, {})

      expect(Array.isArray(links)).toBe(true)
      expect(total).toBeGreaterThanOrEqual(1)
      expect(links.some((l) => l.id === productLink.id)).toBe(true)

      console.log(`✓ Found ${total} product link(s)`)
    })
  })

  describe('✓ 3. Track clicks (with deduplication)', () => {
    it('should track a referral click', async () => {
      const result = await trackingService.trackClick({
        referralCode: productLink.referralCode,
        productId: testProduct.id,
        sessionId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        referer: 'https://example.com',
      })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)

      console.log('✓ Click tracked')
    })

    it('should deduplicate clicks from same session', async () => {
      // Try to track same click again
      const result2 = await trackingService.trackClick({
        referralCode: productLink.referralCode,
        productId: testProduct.id,
        sessionId, // Same session
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        referer: 'https://example.com',
      })

      // Second attempt should return success but not create duplicate
      expect(result2.success).toBe(true)

      // Verify only 1 click exists for this link + session combo
      const clicks = await prisma.affiliateClick.findMany({
        where: {
          affiliateProductLinkId: productLink.id,
          sessionId,
        },
      })

      expect(clicks.length).toBe(1)

      console.log('✓ Click deduplicated (1 click total for session)')
    })

    it('should allow clicks from different sessions', async () => {
      const sessionId2 = `session_${Date.now()}_2`
      sessionIds.push(sessionId2)

      const result = await trackingService.trackClick({
        referralCode: productLink.referralCode,
        productId: testProduct.id,
        sessionId: sessionId2, // Different session
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 Test Browser',
        referer: 'https://example.com',
      })

      expect(result.success).toBe(true)

      // Verify 2 clicks exist for this link (different sessions)
      const clicks = await prisma.affiliateClick.findMany({
        where: { affiliateProductLinkId: productLink.id },
      })

      expect(clicks.length).toBe(2)

      console.log('✓ Different sessions tracked separately (2 clicks total)')
    })
  })

  describe('✓ 4. Complete order with referral', () => {
    it('should create order with items', async () => {
      testOrder = await prisma.order.create({
        data: {
          userId: buyerUser.id,
          currency: 'USD',
          subtotalAmountCents: 10000,
          discountTotalAmountCents: 0,
          taxAmountCents: 0,
          shippingCostCents: 0,
          totalBeforePaymentCents: 10000,
          finalTotalAmountCents: 10000,
          status: 'PENDING',
          fulfillmentStatus: 'pending',
          appliedDiscounts: [],
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                unitPriceCents: 10000,
                quantity: 1,
                subtotalAmountCents: 10000,
              },
            ],
          },
        },
        include: { items: true },
      })

      createdOrderIds.push(testOrder.id)

      expect(testOrder).toBeDefined()
      expect(testOrder.items.length).toBe(1)

      console.log('✓ Order created:', testOrder.id)
    })
  })

  describe('✓ 5. Verify commission created', () => {
    it('should create commission for order with referral', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      // Simulate referral resolution (what order integration does)
      const referrals = new Map<number, string>()
      referrals.set(testProduct.id, productLink.referralCode)

      // Process referrals
      const commissions = await integrationService.processOrderReferrals(
        testOrder.id,
        buyerUser.id,
        testOrder.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          subtotalAmountCents: it.subtotalAmountCents,
        })),
        referrals,
        testOrder.currency
      )

      expect(Array.isArray(commissions)).toBe(true)
      expect(commissions.length).toBe(1)
      expect(commissions[0].orderId).toBe(testOrder.id)
      expect(commissions[0].status).toBe('pending')

      // Commission amount = 10000 * 0.15 = 1500 cents ($15)
      expect(commissions[0].amountCents).toBe(1500)

      console.log(`✓ Commission created: ${commissions[0].id}`)
      console.log(`  Amount: ${commissions[0].amountCents} cents`)
      console.log(`  Status: ${commissions[0].status}`)
    })

    it('should not create commission for self-purchase', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      const selfOrderId = `order_self_${Date.now()}`

      // Try to attribute to self (affiliate is the buyer)
      const referrals = new Map<number, string>()
      referrals.set(testProduct.id, productLink.referralCode)

      const commissions = await integrationService.processOrderReferrals(
        selfOrderId,
        affiliateUser.id, // Same as affiliate!
        [
          {
            id: `item_${Date.now()}`,
            productId: testProduct.id,
            subtotalAmountCents: 10000,
          },
        ],
        referrals,
        'USD'
      )

      // Self-purchase should be blocked (no commissions)
      expect(commissions.length).toBe(0)

      console.log('✓ Self-purchase blocked (no commissions created)')
    })
  })

  describe('✓ 6. Fulfill order → commission approved', () => {
    it('should approve commission when order is fulfilled', async () => {
      // Get commission
      const commissions = await prisma.affiliateCommission.findMany({
        where: { orderId: testOrder.id },
      })

      expect(commissions.length).toBeGreaterThan(0)
      const commission = commissions[0]
      expect(commission.status).toBe('pending')

      // Approve via integration service (simulates fulfillment event)
      const count = await integrationService.approveOrderCommissions(testOrder.id)

      expect(count).toBeGreaterThan(0)

      // Verify status changed
      const updated = await prisma.affiliateCommission.findUnique({
        where: { id: commission.id },
      })

      expect(updated?.status).toBe('approved')
      expect(updated?.approvedAt).toBeDefined()

      console.log(`✓ ${count} commission(s) approved`)
      console.log(`  Status: pending → approved`)
    })
  })

  describe('✓ 7. Process refund → commission cancelled', () => {
    it('should cancel commission on full refund', async () => {
      const refundId = `refund_${Date.now()}`

      // Cancel commissions (simulates refund event)
      const count = await integrationService.handleFullRefund(
        testOrder.id,
        refundId,
        'customer_requested'
      )

      expect(count).toBeGreaterThan(0)

      // Verify status changed
      const commissions = await prisma.affiliateCommission.findMany({
        where: { orderId: testOrder.id },
      })

      expect(commissions[0].status).toBe('cancelled')
      expect(commissions[0].cancellationReason).toBe('customer_requested')
      expect(commissions[0].refundId).toBe(refundId)

      console.log(`✓ ${count} commission(s) cancelled on refund`)
      console.log(`  Status: approved → cancelled`)
      console.log(`  Reason: customer_requested`)
    })

    it('should handle partial refund for specific items', async () => {
      // Create new order for partial refund test
      const order2 = await prisma.order.create({
        data: {
          userId: buyerUser.id,
          currency: 'USD',
          subtotalAmountCents: 20000,
          discountTotalAmountCents: 0,
          taxAmountCents: 0,
          shippingCostCents: 0,
          totalBeforePaymentCents: 20000,
          finalTotalAmountCents: 20000,
          status: 'PENDING',
          fulfillmentStatus: 'pending',
          appliedDiscounts: [],
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                unitPriceCents: 10000,
                quantity: 2, // 2 items
                subtotalAmountCents: 20000,
              },
            ],
          },
        },
        include: { items: true },
      })

      createdOrderIds.push(order2.id)

      // Create commission
      const referrals = new Map<number, string>()
      referrals.set(testProduct.id, productLink.referralCode)

      const commissions = await integrationService.processOrderReferrals(
        order2.id,
        buyerUser.id,
        order2.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          subtotalAmountCents: it.subtotalAmountCents,
        })),
        referrals,
        order2.currency
      )

      expect(commissions.length).toBe(1)

      // Approve it
      await integrationService.approveOrderCommissions(order2.id)

      // Partial refund on one item
      const refundId = `refund_partial_${Date.now()}`
      const itemId = order2.items[0].id

      const count = await integrationService.handleItemRefund(
        order2.id,
        itemId,
        refundId,
        'partial_refund'
      )

      expect(count).toBeGreaterThan(0)

      // Verify commission cancelled
      const updated = await prisma.affiliateCommission.findMany({
        where: { orderId: order2.id },
      })

      expect(updated[0].status).toBe('cancelled')

      console.log(`✓ Partial refund handled`)
      console.log(`  ${count} commission(s) cancelled for item`)
    })
  })

  describe('✓ 8. Create payout batch', () => {
    it('should create a payout batch', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      // Create new approved commission first
      const order3 = await prisma.order.create({
        data: {
          userId: buyerUser.id,
          currency: 'USD',
          subtotalAmountCents: 50000,
          discountTotalAmountCents: 0,
          taxAmountCents: 0,
          shippingCostCents: 0,
          totalBeforePaymentCents: 50000,
          finalTotalAmountCents: 50000,
          status: 'PAID',
          fulfillmentStatus: 'delivered',
          appliedDiscounts: [],
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                unitPriceCents: 50000,
                quantity: 1,
                subtotalAmountCents: 50000,
              },
            ],
          },
        },
        include: { items: true },
      })

      createdOrderIds.push(order3.id)

      const referrals = new Map<number, string>()
      referrals.set(testProduct.id, productLink.referralCode)

      const commissions = await integrationService.processOrderReferrals(
        order3.id,
        buyerUser.id,
        order3.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          subtotalAmountCents: it.subtotalAmountCents,
        })),
        referrals,
        order3.currency
      )

      // Approve it
      await integrationService.approveOrderCommissions(order3.id)

      // Create payout batch
      const batch = await commissionService.createPayoutBatch({
        affiliateId: affiliate!.id,
        paymentMethod: 'paypal',
      })

      createdPayoutBatchIds.push(batch.id)

      expect(batch).toBeDefined()
      expect(batch.status).toBe('pending')
      expect(batch.commissionCount).toBeGreaterThan(0)

      console.log('✓ Payout batch created:', batch.id)
      console.log(`  Commissions: ${batch.commissionCount}`)
      console.log(`  Amount: ${batch.totalAmountCents} cents`)
    })
  })

  describe('✓ 9. Mark payout as paid', () => {
    it('should mark payout batch as paid', async () => {
      const batches = await prisma.affiliatePayoutBatch.findMany({
        where: { status: 'pending' },
        take: 1,
      })

      if (batches.length === 0) {
        console.log('⊘ No pending batches to test (skipping)')
        return
      }

      const batch = batches[0]

      // Mark as paid
      const updated = await commissionService.markPayoutAsPaid(
        batch.id,
        'payment_ref_12345'
      )

      expect(updated.status).toBe('paid')
      expect(updated.paymentReference).toBe('payment_ref_12345')
      expect(updated.paidAt).toBeDefined()

      console.log('✓ Payout marked as paid:', batch.id)
      console.log(`  Payment reference: ${updated.paymentReference}`)

      // Verify commissions status changed to paid
      const commissions = await prisma.affiliateCommission.findMany({
        where: { payoutBatchId: batch.id },
      })

      expect(commissions.every((c) => c.status === 'paid')).toBe(true)

      console.log(`  ${commissions.length} commission(s) marked as paid`)
    })
  })

  describe('✓ 10. Verify self-purchase blocked', () => {
    it('should prevent affiliate from earning on own orders', async () => {
      const affiliate = await affiliateService.getAffiliateByUserId(affiliateUser.id)

      // Create order where affiliate is the buyer
      const selfOrder = await prisma.order.create({
        data: {
          userId: affiliateUser.id, // Affiliate as buyer
          currency: 'USD',
          subtotalAmountCents: 30000,
          discountTotalAmountCents: 0,
          taxAmountCents: 0,
          shippingCostCents: 0,
          totalBeforePaymentCents: 30000,
          finalTotalAmountCents: 30000,
          status: 'PENDING',
          fulfillmentStatus: 'pending',
          appliedDiscounts: [],
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                unitPriceCents: 30000,
                quantity: 1,
                subtotalAmountCents: 30000,
              },
            ],
          },
        },
        include: { items: true },
      })

      createdOrderIds.push(selfOrder.id)

      // Try to process referral
      const referrals = new Map<number, string>()
      referrals.set(testProduct.id, productLink.referralCode)

      const commissions = await integrationService.processOrderReferrals(
        selfOrder.id,
        affiliateUser.id, // Affiliate is the buyer
        selfOrder.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          subtotalAmountCents: it.subtotalAmountCents,
        })),
        referrals,
        selfOrder.currency
      )

      // Should not create any commissions
      expect(commissions.length).toBe(0)

      console.log('✓ Self-purchase prevented')
      console.log('  No commissions created for affiliate orders')
    })
  })

  describe('✓ 11. Verify suspended affiliate blocked', () => {
    it('should prevent suspended affiliates from earning', async () => {
      // Create another affiliate
      const suspendableUser = await prisma.user.create({
        data: {
          name: 'Suspendable Affiliate',
          email: 'suspend@test.com',
          password: 'hashed',
          role: 'user',
        },
      })

      createdUserIds.push(suspendableUser.id)

      const suspendableAffiliate = await affiliateService.createAffiliate({
        userId: suspendableUser.id,
        defaultCommissionRate: 0.1,
        payoutEmail: 'suspend-payout@test.com',
        payoutMethod: 'paypal',
      })

      createdAffiliateIds.push(suspendableAffiliate.id)

      // Create link
      const suspendableLink = await affiliateService.createProductLink(
        suspendableAffiliate.id,
        {
          productId: testProduct.id,
        }
      )

      createdLinkIds.push(suspendableLink.id)

      // Suspend affiliate
      await affiliateService.updateAffiliate(suspendableAffiliate.id, {
        status: 'suspended',
      })

      // Try to create order with suspended affiliate's link
      const order4 = await prisma.order.create({
        data: {
          userId: buyerUser.id,
          currency: 'USD',
          subtotalAmountCents: 25000,
          discountTotalAmountCents: 0,
          taxAmountCents: 0,
          shippingCostCents: 0,
          totalBeforePaymentCents: 25000,
          finalTotalAmountCents: 25000,
          status: 'PENDING',
          fulfillmentStatus: 'pending',
          appliedDiscounts: [],
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                unitPriceCents: 25000,
                quantity: 1,
                subtotalAmountCents: 25000,
              },
            ],
          },
        },
        include: { items: true },
      })

      createdOrderIds.push(order4.id)

      const referrals = new Map<number, string>()
      referrals.set(testProduct.id, suspendableLink.referralCode)

      const commissions = await integrationService.processOrderReferrals(
        order4.id,
        buyerUser.id,
        order4.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          subtotalAmountCents: it.subtotalAmountCents,
        })),
        referrals,
        order4.currency
      )

      // Should not create commissions for suspended affiliate
      expect(commissions.length).toBe(0)

      console.log('✓ Suspended affiliate blocked')
      console.log('  No commissions for suspended affiliates')

      // Cleanup: handled in afterAll
    })
  })
})
