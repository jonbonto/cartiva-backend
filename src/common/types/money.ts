/**
 * PHASE 4: Money Value Object
 * 
 * Core principle: Money is NEVER just a number.
 * Currency MUST be explicit and immutable.
 * 
 * Design rationale:
 * - Prevents implicit conversions between currencies
 * - Makes business logic currency-agnostic
 * - Forces explicit currency handling at all boundaries
 */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'IDR'

export interface Money {
  amountCents: number // Always in smallest currency unit (cents for USD, yen for JPY, etc.)
  currency: CurrencyCode
}

export class MoneyValue {
  readonly amountCents: number
  readonly currency: CurrencyCode

  constructor(amountCents: number, currency: CurrencyCode) {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new Error(`Invalid amount: ${amountCents}. Must be non-negative integer.`)
    }
    this.amountCents = amountCents
    this.currency = currency
  }

  /**
   * Add two Money values — must be same currency
   * Fails loudly if currencies mismatch
   */
  add(other: Money): MoneyValue {
    if (other.currency !== this.currency) {
      throw new Error(
        `Cannot add ${other.currency} to ${this.currency}. Use exchange rate service.`
      )
    }
    return new MoneyValue(this.amountCents + other.amountCents, this.currency)
  }

  /**
   * Subtract two Money values — must be same currency
   */
  subtract(other: Money): MoneyValue {
    if (other.currency !== this.currency) {
      throw new Error(
        `Cannot subtract ${other.currency} from ${this.currency}. Use exchange rate service.`
      )
    }
    const result = this.amountCents - other.amountCents
    if (result < 0) {
      throw new Error(`Subtraction would result in negative amount: ${result}`)
    }
    return new MoneyValue(result, this.currency)
  }

  /**
   * Multiply by a scalar (e.g., quantity)
   * Returns new Money value
   */
  multiply(scalar: number): MoneyValue {
    if (!Number.isInteger(scalar) || scalar < 0) {
      throw new Error(`Invalid multiplier: ${scalar}. Must be non-negative integer.`)
    }
    return new MoneyValue(this.amountCents * scalar, this.currency)
  }

  /**
   * Check if two Money values are equal
   */
  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency
  }

  /**
   * Check if this Money is greater than another
   * Must be same currency
   */
  isGreaterThan(other: Money): boolean {
    if (other.currency !== this.currency) {
      throw new Error(
        `Cannot compare ${this.currency} with ${other.currency}. Use exchange rate service.`
      )
    }
    return this.amountCents > other.amountCents
  }

  /**
   * Check if this Money is less than or equal to another
   */
  isLessThanOrEqual(other: Money): boolean {
    if (other.currency !== this.currency) {
      throw new Error(
        `Cannot compare ${this.currency} with ${other.currency}. Use exchange rate service.`
      )
    }
    return this.amountCents <= other.amountCents
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Money {
    return {
      amountCents: this.amountCents,
      currency: this.currency,
    }
  }

  /**
   * For display/logging purposes only
   * Should NOT be used in calculations
   */
  toString(): string {
    const symbols: Record<CurrencyCode, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      IDR: 'Rp',
    }
    const divisor = this.currency === 'JPY' || this.currency === 'IDR' ? 1 : 100
    return `${symbols[this.currency]}${(this.amountCents / divisor).toFixed(this.currency === 'JPY' ? 0 : 2)}`
  }
}
