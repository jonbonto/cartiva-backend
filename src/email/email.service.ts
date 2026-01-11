import { Injectable, Logger } from '@nestjs/common'

/**
 * PHASE 6: Email Service
 * 
 * Responsibilities:
 * - Send transactional emails
 * - Queue emails for reliability (even if simple)
 * - Never block main application flow
 * - Log all emails for audit trail
 * 
 * Implementation:
 * - Currently uses console logging (for demo)
 * - Can be swapped for SendGrid, AWS SES, etc. via abstraction
 * 
 * Future: Integrate with job queue (Bull, RabbitMQ, etc.)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  /**
   * Send order confirmation email
   * Triggered after order is created (before payment)
   */
  async sendOrderConfirmation(
    email: string,
    orderId: string,
    items: Array<{ productName: string; quantity: number; unitPriceCents: number }>,
    totalCents: number,
    currency: string
  ): Promise<void> {
    const subject = `Order Confirmation #${orderId}`
    const totalFormatted = (totalCents / 100).toFixed(2)
    const itemsHtml = items
      .map(
        (item) =>
          `<tr><td>${item.productName}</td><td>${item.quantity}</td><td>${((item.unitPriceCents * item.quantity) / 100).toFixed(2)} ${currency}</td></tr>`
      )
      .join('')

    const html = `
      <h1>Order Confirmation</h1>
      <p>Thank you for your order!</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <table border="1" cellpadding="8">
        <tr><th>Product</th><th>Quantity</th><th>Amount</th></tr>
        ${itemsHtml}
      </table>
      <p><strong>Total:</strong> ${totalFormatted} ${currency}</p>
      <p>Your order is ready for payment. Please continue to checkout to complete your purchase.</p>
    `

    await this.sendEmail(email, subject, html)
  }

  /**
   * Send payment success email
   * Triggered when webhook confirms payment is paid
   */
  async sendPaymentSuccess(
    email: string,
    orderId: string,
    amountCents: number,
    currency: string,
    provider: string
  ): Promise<void> {
    const subject = `Payment Confirmed #${orderId}`
    const amount = (amountCents / 100).toFixed(2)

    const html = `
      <h1>Payment Confirmed</h1>
      <p>Thank you! Your payment has been received successfully.</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Amount:</strong> ${amount} ${currency}</p>
      <p><strong>Payment Provider:</strong> ${provider}</p>
      <p>Your order is now being processed. We'll send you tracking information once it ships.</p>
    `

    await this.sendEmail(email, subject, html)
  }

  /**
   * Send payment failure email
   * Triggered when webhook confirms payment failed
   */
  async sendPaymentFailure(
    email: string,
    orderId: string,
    reason?: string
  ): Promise<void> {
    const subject = `Payment Failed #${orderId}`

    const html = `
      <h1>Payment Failed</h1>
      <p>Unfortunately, your payment could not be processed.</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>Please try again with a different payment method or contact us for assistance.</p>
    `

    await this.sendEmail(email, subject, html)
  }

  /**
   * Send refund confirmation email
   * Triggered when admin initiates refund
   */
  async sendRefundConfirmation(
    email: string,
    orderId: string,
    refundAmountCents: number,
    totalAmountCents: number,
    currency: string,
    reason?: string
  ): Promise<void> {
    const refundAmount = (refundAmountCents / 100).toFixed(2)
    const totalAmount = (totalAmountCents / 100).toFixed(2)
    const isPartial = refundAmountCents < totalAmountCents

    const subject = `Refund Confirmation #${orderId}`

    const html = `
      <h1>${isPartial ? 'Partial Refund' : 'Refund'} Confirmation</h1>
      <p>We have processed a refund for your order.</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Original Amount:</strong> ${totalAmount} ${currency}</p>
      <p><strong>Refunded Amount:</strong> ${refundAmount} ${currency}</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>The refund will be credited back to your original payment method within 3-5 business days.</p>
    `

    await this.sendEmail(email, subject, html)
  }

  /**
   * Core email sending logic
   * Can be overridden by actual email provider implementation
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    try {
      // For now, log to console (demo)
      this.logger.log(`
        ──────────────────────────────────────
        EMAIL QUEUED FOR DELIVERY
        ──────────────────────────────────────
        To: ${to}
        Subject: ${subject}
        ──────────────────────────────────────
        ${html}
        ──────────────────────────────────────
      `)

      // Future: Queue to job service
      // await this.jobService.queueEmail({ to, subject, html })

      // Or send directly:
      // await this.sendGridService.send({ to, subject, html })
      // await this.sesService.send({ to, subject, html })
    } catch (error) {
      this.logger.error(
        `Failed to queue email to ${to}: ${error.message}`,
        error.stack
      )
      // CRITICAL: Do NOT throw - email failures should not block main flow
      // Instead, log for manual retry
    }
  }
}
