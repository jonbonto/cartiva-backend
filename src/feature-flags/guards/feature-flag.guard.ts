import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  Logger
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FeatureFlagsService, FeatureFlag } from '../feature-flags.service'
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator'

/**
 * Guard to protect endpoints with feature flags
 * 
 * Automatically denies access to endpoints decorated with @RequiresFeatureFlag
 * when the flag is disabled.
 * 
 * @example
 * ```typescript
 * @Post('v2')
 * @RequiresFeatureFlag(FeatureFlag.ORDERS_CLEAN_ARCHITECTURE)
 * @UseGuards(FeatureFlagGuard)
 * async createOrderV2(@Body() dto: CreateOrderDto) {
 *   // Only accessible when flag is enabled
 * }
 * ```
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name)
  
  constructor(
    private reflector: Reflector,
    private featureFlags: FeatureFlagsService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFlag = this.reflector.get<FeatureFlag>(
      FEATURE_FLAG_KEY,
      context.getHandler()
    )

    // No flag required = allow access
    if (!requiredFlag) {
      return true
    }

    const isEnabled = this.featureFlags.isEnabled(requiredFlag)

    if (!isEnabled) {
      this.logger.warn(
        `Access denied to ${context.getClass().name}.${context.getHandler().name} - ` +
        `flag '${requiredFlag}' is disabled`
      )
      throw new NotFoundException('Feature not available')
    }

    this.logger.debug(
      `Access granted to ${context.getClass().name}.${context.getHandler().name} - ` +
      `flag '${requiredFlag}' is enabled`
    )

    return true
  }
}
