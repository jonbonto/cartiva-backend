import { SetMetadata } from '@nestjs/common'
import { FeatureFlag } from '../feature-flags.service'

export const FEATURE_FLAG_KEY = 'featureFlag'

/**
 * Decorator to mark an endpoint as requiring a specific feature flag
 * 
 * Use with FeatureFlagGuard to automatically block access when flag is disabled.
 * 
 * @param flag - Required feature flag
 * 
 * @example
 * ```typescript
 * @Controller('api/orders')
 * export class OrdersController {
 *   @Post('v2')
 *   @RequiresFeatureFlag(FeatureFlag.ORDERS_CLEAN_ARCHITECTURE)
 *   @UseGuards(FeatureFlagGuard)
 *   async createOrderV2(@Body() dto: CreateOrderDto) {
 *     // Only accessible when flag is enabled
 *     return this.createOrderUseCase.execute(dto)
 *   }
 * }
 * ```
 */
export const RequiresFeatureFlag = (flag: FeatureFlag) =>
  SetMetadata(FEATURE_FLAG_KEY, flag)
