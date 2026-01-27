import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import { AffiliateModule } from '../affiliate.module'
import { AffiliateApplicationService } from '../services/affiliate-application.service'
import { AffiliateService } from '../services/affiliate.service'

/**
 * Integration tests for affiliate application system
 * Tests the complete workflow: apply → review → approve/reject
 */
describe('Affiliate Application System - Integration Tests', () => {
  let module: TestingModule
  let prisma: PrismaService
  let applicationService: AffiliateApplicationService
  let affiliateService: AffiliateService
  
  // Track created resources for cleanup
  const createdUserIds: number[] = []
  const createdApplicationIds: string[] = []
  const createdAffiliateIds: string[] = []

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AffiliateModule],
    }).compile()

    prisma = module.get<PrismaService>(PrismaService)
    applicationService = module.get<AffiliateApplicationService>(AffiliateApplicationService)
    affiliateService = module.get<AffiliateService>(AffiliateService)
  })

  afterAll(async () => {
    // Cleanup: delete only records created by this test. Be defensive about
    // foreign key constraints by removing affiliates linked to created users
    // as well as affiliates created by id. Ensure we always disconnect.
    try {
      if (createdAffiliateIds.length > 0 || createdUserIds.length > 0) {
        const orClauses: any[] = []
        if (createdAffiliateIds.length > 0) orClauses.push({ id: { in: createdAffiliateIds } })
        if (createdUserIds.length > 0) orClauses.push({ userId: { in: createdUserIds } })

        await prisma.affiliate.deleteMany({
          where: { OR: orClauses },
        })
      }

      if (createdApplicationIds.length > 0) {
        await prisma.affiliateApplication.deleteMany({
          where: { id: { in: createdApplicationIds } },
        })
      }

      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        })
      }
    } catch (e) {
      // Log cleanup errors but don't fail the suite because of teardown issues
      // (helps CI recover and still disconnect below).
      // eslint-disable-next-line no-console
      console.error('Cleanup failed:', e && e.message ? e.message : e)
    } finally {
      // Close the Nest testing module to stop any background providers (queues, timers, etc.)
      try {
        if (module && typeof module.close === 'function') {
          // ignore errors closing module
          // eslint-disable-next-line no-await-in-loop
          await module.close()
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error closing test module:', err && err.message ? err.message : err)
      }

      await prisma.$disconnect()
    }
  })

  // =========================================================================
  // TEST SUITE: Application Submission
  // =========================================================================

  describe('1. User applies for affiliate program', () => {
    it('should submit affiliate application successfully', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: `test-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      const result = await applicationService.applyForAffiliate(user.id, {
        email: 'affiliate@example.com',
        payoutMethod: 'paypal',
        payoutDetails: { paypal_email: 'payments@example.com' },
        notes: 'I want to promote your products',
      })

      expect(result).toHaveProperty('id')
      expect(result.userId).toBe(user.id)
      expect(result.status).toBe('pending')
      expect(result.email).toBe('affiliate@example.com')

      createdApplicationIds.push(result.id)
      console.log('✓ Application submitted successfully:', result.id)
    })

    it('should prevent duplicate applications', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Dup User',
          email: `dup-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      // First application
      const firstApp = await applicationService.applyForAffiliate(user.id, {
        email: 'first@example.com',
      })
      createdApplicationIds.push(firstApp.id)

      // Second application should fail
      const error = await applicationService.applyForAffiliate(user.id, {
        email: 'second@example.com',
      }).catch(e => e)

      expect(error.message).toContain('pending application')
      console.log('✓ Duplicate application prevention works')
    })
  })

  // =========================================================================
  // TEST SUITE: Check Application Status
  // =========================================================================

  describe('2. User checks application status', () => {
    let applicationId: string
    let userId: number

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Status User',
          email: `status-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      userId = user.id
      createdUserIds.push(userId)

      const result = await applicationService.applyForAffiliate(userId, {
        email: 'status@example.com',
      })
      applicationId = result.id
      createdApplicationIds.push(applicationId)
    })

    it('should return application status when exists', async () => {
      const result = await applicationService.getApplicationByUserId(userId)

      expect(result).toBeDefined()
      expect(result.status).toBe('pending')
      expect(result.email).toBe('status@example.com')
      console.log('✓ User can check application status')
    })

    it('should return null when no application', async () => {
      const newUser = await prisma.user.create({
        data: {
          name: 'No App User',
          email: `noapp-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(newUser.id)

      const result = await applicationService.getApplicationByUserId(newUser.id)

      expect(result).toBeNull()
      console.log('✓ No application returns null')
    })
  })

  // =========================================================================
  // TEST SUITE: Admin Reviews Applications
  // =========================================================================

  describe('3. Admin lists and reviews applications', () => {
    let appForReview: any

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Review User',
          email: `review-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      const app = await applicationService.applyForAffiliate(user.id, {
        email: 'review@example.com',
        payoutMethod: 'bank_transfer',
        notes: 'I run a tech blog with 10k monthly readers',
      })

      appForReview = app
      createdApplicationIds.push(app.id)
    })

    it('should list applications', async () => {
      const result = await applicationService.listApplications({
        status: 'pending',
        page: 1,
        limit: 20,
      })

      expect(result).toHaveProperty('applications')
      expect(result).toHaveProperty('pagination')
      expect(Array.isArray(result.applications)).toBe(true)
      expect(result.applications.length).toBeGreaterThan(0)
      console.log(`✓ Admin can list applications (found ${result.applications.length})`)
    })

    it('should get specific application details', async () => {
      const app = await prisma.affiliateApplication.findUnique({
        where: { id: appForReview.id },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      expect(app).toBeDefined()
      expect(app.id).toBe(appForReview.id)
      expect(app.status).toBe('pending')
      console.log('✓ Admin can view application details')
    })

    it('should filter applications by status', async () => {
      const result = await applicationService.listApplications({
        status: 'pending',
      })

      expect(result.applications.every((a: any) => a.status === 'pending')).toBe(true)
      console.log('✓ Application filtering by status works')
    })
  })

  // =========================================================================
  // TEST SUITE: Admin Approves Application
  // =========================================================================

  describe('4. Admin approves application', () => {
    let appToApprove: any
    let applicantUserId: number
    let adminUserId: number

    beforeAll(async () => {
      const applicant = await prisma.user.create({
        data: {
          name: 'Applicant',
          email: `applicant-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      applicantUserId = applicant.id
      createdUserIds.push(applicant.id)

      const admin = await prisma.user.create({
        data: {
          name: 'Admin',
          email: `admin-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'admin',
        },
      })
      adminUserId = admin.id
      createdUserIds.push(admin.id)

      const app = await applicationService.applyForAffiliate(applicant.id, {
        email: 'approve@example.com',
        payoutMethod: 'paypal',
        payoutDetails: { paypal_email: 'approve@paypal.com' },
      })

      appToApprove = app
      createdApplicationIds.push(app.id)
    })

    it('should approve application and create affiliate account', async () => {
      const result = await applicationService.approveApplication(
        appToApprove.id,
        {
          defaultCommissionRate: 0.05,
          payoutMethod: 'paypal',
          payoutDetails: { paypal_email: 'approve@paypal.com' },
          adminNotes: 'Approved - quality site',
        },
        adminUserId
      )

      expect(result).toHaveProperty('id')
      expect(result.status).toBe('active')
      expect(result.userId).toBe(applicantUserId)
      expect(Number(result.defaultCommissionRate)).toBeCloseTo(0.05)

      createdAffiliateIds.push(result.id)
      console.log('✓ Application approved and affiliate account created:', result.id)
    })

    it('should prevent re-approval of approved application', async () => {
      const error = await applicationService
        .approveApplication(
          appToApprove.id,
          { defaultCommissionRate: 0.1 },
          adminUserId
        )
        .catch(e => e)

      expect(error.message).toContain('Cannot approve application')
      console.log('✓ Re-approval prevention works')
    })

    it('should prevent affiliated user from applying again', async () => {
      const error = await applicationService
        .applyForAffiliate(applicantUserId, {
          email: 'second@example.com',
        })
        .catch(e => e)

      expect(error.message).toContain('already has an affiliate account')
      console.log('✓ Affiliated user cannot apply again')
    })
  })

  // =========================================================================
  // TEST SUITE: Admin Rejects Application
  // =========================================================================

  describe('5. Admin rejects application', () => {
    let appToReject: any
    let adminId: number

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Reject User',
          email: `reject-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      const admin = await prisma.user.create({
        data: {
          name: 'Admin2',
          email: `admin2-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'admin',
        },
      })
      adminId = admin.id
      createdUserIds.push(admin.id)

      const app = await applicationService.applyForAffiliate(user.id, {
        email: 'reject@example.com',
      })

      appToReject = app
      createdApplicationIds.push(app.id)
    })

    it('should reject application', async () => {
      const result = await applicationService.rejectApplication(
        appToReject.id,
        { adminNotes: 'Does not meet quality standards' },
        adminId
      )

      expect(result.status).toBe('rejected')
      expect(result.adminNotes).toBe('Does not meet quality standards')
      console.log('✓ Application rejected successfully')
    })

    it('should prevent re-rejection of rejected application', async () => {
      const error = await applicationService
        .rejectApplication(
          appToReject.id,
          { adminNotes: 'Rejected again' },
          adminId
        )
        .catch(e => e)

      expect(error.message).toContain('Cannot reject application')
      console.log('✓ Re-rejection prevention works')
    })
  })

  // =========================================================================
  // TEST SUITE: Business Logic & Constraints
  // =========================================================================

  describe('6. Business logic and constraints', () => {
    it('should track admin review metadata', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Metadata User',
          email: `metadata-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      const admin = await prisma.user.create({
        data: {
          name: 'MetadataAdmin',
          email: `metadataadmin-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'admin',
        },
      })
      createdUserIds.push(admin.id)

      const app = await applicationService.applyForAffiliate(user.id, {
        email: 'metadata@example.com',
      })
      createdApplicationIds.push(app.id)

      const approved = await applicationService.approveApplication(
        app.id,
        { defaultCommissionRate: 0.08, adminNotes: 'Great potential' },
        admin.id
      )
      createdAffiliateIds.push(approved.id)

      const updated = await prisma.affiliateApplication.findUnique({
        where: { id: app.id },
      })

      expect(updated.reviewedBy).toBe(admin.id)
      expect(updated.reviewedAt).toBeDefined()
      expect(updated.adminNotes).toBe('Great potential')
      console.log('✓ Admin review metadata tracked correctly')
    })

    it('should preserve application details when creating affiliate', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Details User',
          email: `details-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      const admin = await prisma.user.create({
        data: {
          name: 'DetailsAdmin',
          email: `detailsadmin-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'admin',
        },
      })
      createdUserIds.push(admin.id)

      const app = await applicationService.applyForAffiliate(user.id, {
        email: 'details@example.com',
        payoutMethod: 'stripe',
        payoutDetails: { stripe_account_id: 'acct_123' },
        notes: 'Influencer with 50k followers',
      })
      createdApplicationIds.push(app.id)

      const approved = await applicationService.approveApplication(
        app.id,
        { defaultCommissionRate: 0.15 },
        admin.id
      )
      createdAffiliateIds.push(approved.id)

      const affiliate = await affiliateService.getAffiliateById(approved.id)

      expect(affiliate.payoutEmail).toBe('details@example.com')
      expect(affiliate.payoutMethod).toBe('stripe')
      console.log('✓ Application details preserved in affiliate account')
    })
  })

  // =========================================================================
  // TEST SUITE: Integration with Affiliate Workflow
  // =========================================================================

  describe('7. Integration with affiliate account workflow', () => {
    it('should allow approved affiliate to use affiliate services', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Workflow User',
          email: `workflow-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'user',
        },
      })
      createdUserIds.push(user.id)

      const admin = await prisma.user.create({
        data: {
          name: 'WorkflowAdmin',
          email: `workflowadmin-${Date.now()}@example.com`,
          password: 'hashed',
          role: 'admin',
        },
      })
      createdUserIds.push(admin.id)

      const app = await applicationService.applyForAffiliate(user.id, {
        email: 'workflow@example.com',
      })
 

      const approved = await applicationService.approveApplication(
        app.id,
        { defaultCommissionRate: 0.1 },
        admin.id
      )
      createdAffiliateIds.push(approved.id)

      // Verify affiliate is active and usable
      const affiliate = await affiliateService.getAffiliateByUserId(user.id)

      expect(affiliate).toBeDefined()
      expect(affiliate.status).toBe('active')
      expect(Number(affiliate.defaultCommissionRate)).toBeCloseTo(0.1)
      console.log('✓ Approved affiliate fully integrated into affiliate system')
    })
  })
})
