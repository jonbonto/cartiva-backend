import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { AppModule } from '../../app.module'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from '../../auth/auth.service'
import { PAYMENT_TOKEN_VALIDATOR } from '../../users/domain/payment-token.validator'

describe('UsersController (DB integration)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let authService: AuthService
  let token: string
  let userId: number

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_TOKEN_VALIDATOR)
      .useValue({ validate: async () => true })
      .compile()
    app = moduleRef.createNestApplication()
    await app.init()

    prisma = moduleRef.get(PrismaService)
    authService = moduleRef.get(AuthService)
  })

  beforeEach(async () => {
    // Create a fresh test user per test to improve isolation
    const email = `inttest+${Date.now()}+${Math.random().toString(36).slice(2)}@example.com`
    const { user, token: t } = await authService.signup({ name: 'Int Test', email, password: 'Password123' })
    token = t
    userId = user.id
  })

  afterEach(async () => {
    // Clean up test data per test to avoid cross-test contamination
    await prisma.userPaymentMethod.deleteMany({ where: { userId } }).catch(() => {})
    await prisma.userShippingAddress.deleteMany({ where: { userId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates a shipping address and persists it', async () => {
    const dto = {
      fullName: 'Jane Doe',
      streetLine1: '123 Test St',
      city: 'Testville',
      stateProvince: 'TS',
      postalCode: '12345',
      country: 'US',
    }

    const res = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)

    expect([200, 201]).toContain(res.status)
    const id = res.body?.id
    expect(id).toBeDefined()

    const saved = await prisma.userShippingAddress.findUnique({ where: { id } })
    expect(saved).toBeTruthy()
    expect(saved?.userId).toBe(userId)
    expect(saved?.streetLine1).toBe(dto.streetLine1)
  })

  it('adds a payment method and persists it', async () => {
    const dto = {
      provider: 'stripe',
      providerTokenId: 'tok_test_123',
      type: 'card',
      brand: 'visa',
      last4Digits: '4242',
      expiryMonth: 12,
      expiryYear: 2030,
      cardholderName: 'Jane Doe',
      label: 'Test Card',
    }

    const res = await request(app.getHttpServer())
      .post('/api/users/me/payment-methods')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)

    expect([200, 201]).toContain(res.status)
    const id = res.body?.id
    expect(id).toBeDefined()

    const saved = await prisma.userPaymentMethod.findUnique({ where: { id } })
    expect(saved).toBeTruthy()
    expect(saved?.userId).toBe(userId)
    expect(saved?.provider).toBe('stripe')
  })
})
