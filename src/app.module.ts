import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { DomainServicesModule } from './services/phase6.module'
import { TaxModule } from './tax/tax.module'
import { ShippingModule } from './shipping/shipping.module'
import { ShippingController } from './shipping/shipping.controller'
import { TaxController } from './tax/tax.controller'
import { QueueModule } from './queues/queue.module'
import { ProductsModule } from './products/products.module'
import { CartModule } from './cart/cart.module'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { OrdersModule } from './orders/orders.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { UsersModule } from './users/users.module'
import { EnvironmentValidator } from './common/environment.validator'
import { BullModule } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'
import { FeatureFlagsModule } from './feature-flags/feature-flags.module'
import { DiscountRuleModule } from './discount-rule/discount-rule.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FeatureFlagsModule, // Global feature flags - available everywhere
    FeatureFlagsModule, // Global feature flags - must be early in import order
    // Global Bull configuration moved to AppModule so queues register correctly
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    DomainServicesModule,
    TaxModule,
    ShippingModule,
    ProductsModule,
    CartModule,
    AdminModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    AnalyticsModule,
    QueueModule,
    DiscountRuleModule
  ],
  controllers: [ShippingController, TaxController],
  providers: [EnvironmentValidator],
})
export class AppModule {}
