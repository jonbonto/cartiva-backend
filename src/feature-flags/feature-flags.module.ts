import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FeatureFlagsService } from './feature-flags.service'

/**
 * Feature Flags Module
 * 
 * Provides centralized feature flag management.
 * Marked as @Global() so it's available everywhere without explicit import.
 * 
 * Usage:
 * 1. Import FeatureFlagsModule in AppModule
 * 2. Inject FeatureFlagsService anywhere in the app
 * 3. Use isEnabled() to check flag status
 * 
 * @example
 * ```typescript
 * // app.module.ts
 * @Module({
 *   imports: [FeatureFlagsModule, ...],
 * })
 * export class AppModule {}
 * 
 * // any.service.ts
 * @Injectable()
 * export class AnyService {
 *   constructor(private featureFlags: FeatureFlagsService) {}
 *   
 *   async myMethod() {
 *     if (this.featureFlags.isEnabled('new_feature')) {
 *       // new implementation
 *     }
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
