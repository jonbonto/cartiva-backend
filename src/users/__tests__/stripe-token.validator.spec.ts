import Stripe from 'stripe'
import { StripeTokenValidator } from '../adapters/stripe-token.validator'

jest.mock('stripe')

describe('StripeTokenValidator', () => {
  beforeEach(() => {
    jest.resetModules()
    ;(Stripe as unknown as jest.Mock).mockClear()
  })

  it('returns false for missing provider or token', async () => {
    const v = new StripeTokenValidator()
    // @ts-ignore
    expect((await v.validate('', '')).valid).toBe(false)
    // @ts-ignore
    expect((await v.validate('stripe', '')).valid).toBe(false)
    // @ts-ignore
    expect((await v.validate('', 'pm_123')).valid).toBe(false)
  })

  it('falls back to permissive mode when STRIPE_SECRET_KEY not set', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const v = new StripeTokenValidator()
    // valid provider and token but no key -> permissive true
    expect((await v.validate('stripe', 'pm_123')).valid).toBe(true)
  })

  it('uses Stripe SDK when key configured and validate succeeds', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    const retrieve = jest.fn().mockResolvedValue({ id: 'pm_abc' })
    ;(Stripe as unknown as jest.Mock).mockImplementation(() => ({ paymentMethods: { retrieve } }))

    const v = new StripeTokenValidator()
    expect((await v.validate('stripe', 'pm_abc')).valid).toBe(true)
    expect(retrieve).toHaveBeenCalledWith('pm_abc')
  })

  it('returns false when Stripe retrieve fails', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    const retrieve = jest.fn().mockRejectedValue(new Error('not found'))
    ;(Stripe as unknown as jest.Mock).mockImplementation(() => ({ paymentMethods: { retrieve } }))

    const v = new StripeTokenValidator()
    expect((await v.validate('stripe', 'pm_missing')).valid).toBe(false)
  })
})
