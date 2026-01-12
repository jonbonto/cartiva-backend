import { Injectable, Logger } from '@nestjs/common'
import sgMail from '@sendgrid/mail'
import * as fs from 'fs'
import * as path from 'path'
import * as Handlebars from 'handlebars'

/**
 * Email Template Context
 * Defines the data structure passed to email templates
 */
interface EmailTemplateContext {
  orderId: string
  items?: Array<{
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
  subtotal?: number
  discount?: number
  tax?: number
  shipping?: number
  total?: number
  amount?: number
  paymentMethod?: string
  transactionId?: string
  paidAt?: Date
  attemptedAt?: Date
  orderTotal?: number
  reason?: string
  checkoutUrl: string
  supportUrl?: string
  companyName: string
  currentYear: number
  [key: string]: any
}

/**
 * Email Template Type
 */
type EmailTemplate = 'order-confirmation' | 'payment-success' | 'payment-failed'

/**
 * PHASE 6: SendGrid Email Service
 *
 * Responsibilities:
 * - Send production-grade transactional emails via SendGrid
 * - Support HTML templates with Handlebars templating
 * - Handle non-production environments (sandbox/disabled mode)
 * - Provide comprehensive error handling and logging
 * - Never block main application flow (queue-ready)
 *
 * Architecture:
 * - Clean separation of email logic from business logic
 * - Dependency injection for easy testing/mocking
 * - Environment-based configuration
 * - Graceful degradation for development environments
 *
 * Security:
 * - Never expose API keys in logs
 * - Validate email addresses before sending
 * - Rate limiting support via SendGrid
 * - Audit trail via logging
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly sendgridApiKey: string
  private readonly fromEmail: string
  private readonly isProduction: boolean
  private readonly templateCache: Map<EmailTemplate, HandlebarsTemplateDelegate> =
    new Map()

  constructor() {
    // Configuration from environment
    this.sendgridApiKey = process.env.SENDGRID_API_KEY || ''
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@ecommerce.local'
    this.isProduction =
      process.env.NODE_ENV === 'production' &&
      !!this.sendgridApiKey

    // Initialize SendGrid only in production
    if (this.isProduction) {
      sgMail.setApiKey(this.sendgridApiKey)
      this.logger.log('SendGrid initialized (production mode)')
    } else {
      this.logger.warn(
        'SendGrid disabled - running in development mode. Emails will be logged.'
      )
    }

    // Pre-load templates
    this.preloadTemplates()
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    recipientEmail: string,
    orderId: string,
    items: Array<{ productName: string; quantity: number; unitPriceCents: number }>,
    totalCents: number,
    currency: string
  ): Promise<void> {
    const context: EmailTemplateContext = {
      orderId,
      items: items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents / 100,
        subtotal: (item.unitPriceCents * item.quantity) / 100,
      })),
      subtotal: totalCents / 100,
      total: totalCents / 100,
      checkoutUrl: `${process.env.FRONTEND_URL}/checkout/${orderId}`,
      companyName: process.env.COMPANY_NAME || 'E-Commerce Store',
      currentYear: new Date().getFullYear(),
    }

    await this.sendEmail(
      recipientEmail,
      'order-confirmation',
      `Order Confirmation #${orderId}`,
      context
    )
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccess(
    recipientEmail: string,
    orderId: string,
    amountCents: number,
    currency: string,
    provider: string,
    transactionId: string
  ): Promise<void> {
    const context: EmailTemplateContext = {
      orderId,
      amount: amountCents / 100,
      paymentMethod: this.formatPaymentMethod(provider),
      transactionId,
      paidAt: new Date(),
      checkoutUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`,
      supportUrl: `${process.env.FRONTEND_URL}/support`,
      companyName: process.env.COMPANY_NAME || 'E-Commerce Store',
      currentYear: new Date().getFullYear(),
    }

    await this.sendEmail(
      recipientEmail,
      'payment-success',
      `Payment Confirmed #${orderId}`,
      context
    )
  }

  /**
   * Send payment failure email
   */
  async sendPaymentFailure(
    recipientEmail: string,
    orderId: string,
    orderTotalCents: number,
    reason?: string
  ): Promise<void> {
    const context: EmailTemplateContext = {
      orderId,
      orderTotal: orderTotalCents / 100,
      reason:
        reason ||
        'Your payment could not be processed. Please try again or contact support.',
      checkoutUrl: `${process.env.FRONTEND_URL}/checkout/${orderId}`,
      supportUrl: `${process.env.FRONTEND_URL}/support`,
      attemptedAt: new Date(),
      companyName: process.env.COMPANY_NAME || 'E-Commerce Store',
      currentYear: new Date().getFullYear(),
    }

    await this.sendEmail(
      recipientEmail,
      'payment-failed',
      `Payment Failed #${orderId}`,
      context
    )
  }

  /**
   * Generic email sender with template support
   *
   * @param to Recipient email address
   * @param template Template name
   * @param subject Email subject
   * @param context Data for template rendering
   */
  private async sendEmail(
    to: string,
    template: EmailTemplate,
    subject: string,
    context: EmailTemplateContext
  ): Promise<void> {
    try {
      // Validate email
      if (!this.isValidEmail(to)) {
        this.logger.warn(`Skipped email to invalid address: ${to}`)
        return
      }

      // Get compiled template
      const compiledTemplate =
        this.templateCache.get(template) || this.loadTemplate(template)

      // Render HTML
      const html = compiledTemplate(context)

      // Development mode: log only
      if (!this.isProduction) {
        this.logger.log(`[EMAIL] ${to} - ${subject}`)
        this.logger.debug(`[EMAIL HTML]\n${html}`)
        return
      }

      // Production: send via SendGrid
      const message = {
        to,
        from: this.fromEmail,
        subject,
        html,
        replyTo: process.env.SUPPORT_EMAIL || this.fromEmail,
      }

      const response = await sgMail.send(message)
      this.logger.log(
        `Email sent to ${to}: ${subject} [MessageId: ${response[0].headers['x-message-id']}]`
      )
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error instanceof Error ? error.message : String(error)}`
      )
      // In production, log but don't throw - emails should not block order flow
      // Consider implementing a retry queue (Bull, RabbitMQ, etc.)
    }
  }

  /**
   * Load template from disk and compile with Handlebars
   */
  private loadTemplate(template: EmailTemplate): HandlebarsTemplateDelegate {
    try {
      const templatePath = path.join(
        __dirname,
        'templates',
        `${template}.hbs`
      )
      const templateContent = fs.readFileSync(templatePath, 'utf-8')

      // Register custom helpers
      this.registerHandlebarsHelpers()

      const compiled = Handlebars.compile(templateContent)
      this.templateCache.set(template, compiled)

      return compiled
    } catch (error) {
      this.logger.error(
        `Failed to load template ${template}: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Pre-load all templates at startup
   */
  private preloadTemplates(): void {
    const templates: EmailTemplate[] = [
      'order-confirmation',
      'payment-success',
      'payment-failed',
    ]

    for (const template of templates) {
      try {
        this.loadTemplate(template)
        this.logger.debug(`Preloaded template: ${template}`)
      } catch (error) {
        this.logger.warn(
          `Failed to preload template ${template}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  /**
   * Register Handlebars custom helpers
   */
  private registerHandlebarsHelpers(): void {
    Handlebars.registerHelper('formatMoney', (cents: number) => {
      if (typeof cents !== 'number') return '0.00'
      return (cents / 100).toFixed(2)
    })

    Handlebars.registerHelper('formatDate', (date: Date) => {
      if (!(date instanceof Date)) return ''
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    })

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b)
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Format payment provider name for display
   */
  private formatPaymentMethod(provider: string): string {
    const map: Record<string, string> = {
      stripe: 'Stripe',
      midtrans: 'Midtrans',
      paypal: 'PayPal',
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
    }
    return map[provider.toLowerCase()] || provider
  }
}
