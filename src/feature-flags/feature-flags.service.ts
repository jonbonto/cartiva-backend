import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Feature Flag Enum
 * 
 * Centralized registry of all feature flags in the system.
 * Add new flags here when implementing new features or refactorings.
 */
export enum FeatureFlag {
  // Architecture Refactoring Flags (Phase 0-4)
  ORDERS_CLEAN_ARCHITECTURE = 'orders_clean_architecture',
  TAX_SERVICE_LAYER = 'tax_service_layer',
  SHIPPING_SERVICE_LAYER = 'shipping_service_layer',
  INVENTORY_RESERVATION_V2 = 'inventory_reservation_v2',
  
  // Feature Flags (New Features)
  PAYMENT_STRIPE_V2 = 'payment_stripe_v2',
  ANALYTICS_REALTIME = 'analytics_realtime',
  EMAIL_QUEUE_PRIORITY = 'email_queue_priority',
  
  // User Shipping Address & Payment Method (Phase 1)
  USER_SHIPPING_ADDRESS = 'user_shipping_address',
  USER_PAYMENT_METHOD = 'user_payment_method',
  USER_SAVED_ADDRESSES_AT_CHECKOUT = 'user_saved_addresses_at_checkout',
}

/**
 * Context for flag evaluation
 * Used for user-specific or order-specific feature enablement
 */
export interface FlagContext {
  userId?: string
  orderId?: string
  sessionId?: string
  environment?: string
}

/**
 * Feature Flag Service
 * 
 * Provides centralized feature flag management for safe, gradual rollouts.
 * 
 * Phase 1 (Current): Environment variable based flags
 * Phase 2 (Future): Database + percentage rollouts
 * Phase 3 (Future): User targeting + A/B testing
 * 
 * @example
 * ```typescript
 * constructor(private featureFlags: FeatureFlagsService) {}
 * 
 * async myMethod() {
 *   if (this.featureFlags.isEnabled(FeatureFlag.ORDERS_CLEAN_ARCHITECTURE)) {
 *     return this.newImplementation()
 *   }
 *   return this.oldImplementation()
 * }
 * ```
 */
@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name)
  private readonly flagCache = new Map<string, boolean>()
  
  constructor(private config: ConfigService) {
    this.loadFlags()
  }

  /**
   * Check if a feature flag is enabled globally
   * 
   * @param flag - Feature flag to check
   * @returns true if flag is enabled, false otherwise
   */
  isEnabled(flag: FeatureFlag | string): boolean {
    const value = this.flagCache.get(flag)
    
    if (value === undefined) {
      this.logger.warn(`Flag not found: ${flag}, defaulting to false`)
      return false
    }
    
    return value
  }

  /**
   * Check if a feature flag is enabled for a specific context
   * (user, order, etc.)
   * 
   * @param flag - Feature flag to check
   * @param context - Context (userId, orderId, etc.)
   * @returns true if flag is enabled for this context
   * 
   * @example
   * ```typescript
   * const enabled = this.featureFlags.isEnabledFor(
   *   FeatureFlag.PAYMENT_STRIPE_V2,
   *   { userId: '123', orderId: 'order-456' }
   * )
   * ```
   */
  isEnabledFor(flag: FeatureFlag | string, context: FlagContext): boolean {
    // Phase 1: Simple global flags
    const globalEnabled = this.isEnabled(flag)
    
    if (!globalEnabled) return false
    
    // Phase 2: Add percentage rollout logic here
    // const percentage = this.getFlagPercentage(flag)
    // if (percentage < 100 && context.userId) {
    //   const userHash = this.hashUserId(context.userId)
    //   return userHash < percentage
    // }
    
    // Phase 3: Add user targeting logic here
    // if (this.isUserTargeted(flag, context.userId)) {
    //   return true
    // }
    
    return globalEnabled
  }

  /**
   * Get all enabled flags (for debugging/monitoring)
   * 
   * @returns Array of enabled flag names
   */
  getEnabledFlags(): string[] {
    return Array.from(this.flagCache.entries())
      .filter(([_, enabled]) => enabled)
      .map(([flag]) => flag)
  }

  /**
   * Get flag value with detailed info
   * 
   * @param flag - Feature flag to inspect
   * @returns Flag details including name, enabled status, and source
   */
  getFlagDetails(flag: FeatureFlag | string): {
    name: string
    enabled: boolean
    source: string
  } {
    return {
      name: flag,
      enabled: this.isEnabled(flag),
      source: 'environment'
    }
  }

  /**
   * Get all flags with their current values
   * Useful for admin dashboards
   */
  getAllFlags(): Array<{ name: string; enabled: boolean }> {
    return Object.values(FeatureFlag).map(flag => ({
      name: flag,
      enabled: this.isEnabled(flag)
    }))
  }

  /**
   * Load flags from environment variables
   * 
   * Supports two formats:
   * 1. FEATURE_FLAGS=flag1,flag2,flag3 (comma-separated list)
   * 2. FEATURE_FLAG_<NAME>=true|false (individual flags)
   * 
   * Individual flags override the comma-separated list.
   */
  private loadFlags(): void {
    // Initialize all flags to false
    Object.values(FeatureFlag).forEach(flag => {
      this.flagCache.set(flag, false)
    })
    
    // Load from FEATURE_FLAGS env var (comma-separated)
    const flagsEnv = this.config.get<string>('FEATURE_FLAGS', '')
    const enabledFlags = flagsEnv
      .split(',')
      .map(f => f.trim())
      .filter(Boolean)
    
    // Enable flags from comma-separated list
    enabledFlags.forEach(flag => {
      if (Object.values(FeatureFlag).includes(flag as FeatureFlag)) {
        this.flagCache.set(flag, true)
        this.logger.log(`Feature flag enabled: ${flag}`)
      } else {
        this.logger.warn(`Unknown feature flag in FEATURE_FLAGS env var: ${flag}`)
      }
    })
    
    // Load individual flag overrides (FEATURE_FLAG_<NAME>=true/false)
    // This allows fine-grained control and overrides the comma-separated list
    Object.values(FeatureFlag).forEach(flag => {
      const envKey = `FEATURE_FLAG_${flag.toUpperCase().replace(/\./g, '_')}`
      const envValue = this.config.get<string>(envKey)
      
      if (envValue !== undefined) {
        const enabled = envValue === 'true' || envValue === '1'
        this.flagCache.set(flag, enabled)
        this.logger.log(
          `Feature flag ${enabled ? 'enabled' : 'disabled'} via ${envKey}: ${flag}`
        )
      }
    })
    
    this.logger.log(
      `Loaded ${this.flagCache.size} feature flags, ` +
      `${this.getEnabledFlags().length} enabled`
    )
  }
}
