import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

/**
 * PHASE 6: Environment Validation
 * 
 * Prevents production mistakes:
 * - Test keys must not run in production
 * - Live keys must only run in production
 * - All critical env vars must be set
 * 
 * Runs on application startup
 */
@Injectable()
export class EnvironmentValidator implements OnModuleInit {
  private readonly logger = new Logger(EnvironmentValidator.name)

  onModuleInit() {
    this.validateEnvironment()
  }

  private validateEnvironment() {
    const nodeEnv = process.env.NODE_ENV || 'development'
    const isProduction = nodeEnv === 'production'

    this.logger.log(`──────────────────────────────────────`)
    this.logger.log(`ENVIRONMENT: ${nodeEnv}`)
    this.logger.log(`──────────────────────────────────────`)

    // 1. Validate Stripe keys
    this.validateStripeKeys(isProduction)

    // 2. Validate Midtrans keys
    this.validateMidtransKeys(isProduction)

    // 3. Validate critical config
    this.validateCriticalConfig()

    this.logger.log(`✓ Environment validation passed`)
    this.logger.log(`──────────────────────────────────────`)
  }

  private validateStripeKeys(isProduction: boolean) {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripeKey || !stripeWebhookSecret) {
      this.logger.warn(`⚠ Stripe not configured (optional in development)`)
      return
    }

    // Check if using test key in production
    if (isProduction && stripeKey.startsWith('sk_test_')) {
      throw new Error(
        `❌ CRITICAL: Test Stripe key (sk_test_*) must not run in production!`
      )
    }

    // Check if using live key in development
    if (!isProduction && stripeKey.startsWith('sk_live_')) {
      this.logger.warn(
        `⚠ Live Stripe key detected in development - ensure this is intentional`
      )
    }

    this.logger.log(
      `✓ Stripe ${isProduction ? 'LIVE' : 'TEST'} key validated`
    )
  }

  private validateMidtransKeys(isProduction: boolean) {
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY
    const midtransClientKey = process.env.MIDTRANS_CLIENT_KEY

    if (!midtransServerKey || !midtransClientKey) {
      this.logger.warn(`⚠ Midtrans not configured (optional in development)`)
      return
    }

    // Midtrans uses environment flag, check if mismatch
    const midtransEnv = process.env.MIDTRANS_ENV || 'development'

    if (isProduction && midtransEnv !== 'production') {
      throw new Error(
        `❌ CRITICAL: Production Node.js but Midtrans set to ${midtransEnv}!`
      )
    }

    if (!isProduction && midtransEnv === 'production') {
      this.logger.warn(
        `⚠ Midtrans production environment detected in development - ensure intentional`
      )
    }

    this.logger.log(
      `✓ Midtrans ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} validated`
    )
  }

  private validateCriticalConfig() {
    const required = ['DATABASE_URL', 'JWT_SECRET']
    const missing = required.filter((key) => !process.env[key])

    if (missing.length > 0) {
      throw new Error(`❌ Missing required env vars: ${missing.join(', ')}`)
    }

    this.logger.log(`✓ Critical config validated`)
  }
}
