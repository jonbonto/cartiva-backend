import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { QueueModule } from './queues/queue.module'
import { ProductsModule } from './products/products.module'
import { CartModule } from './cart/cart.module'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { OrdersModule } from './orders/orders.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { EnvironmentValidator } from './common/environment.validator'
import { BullModule } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    ProductsModule,
    CartModule,
    AdminModule,
    AuthModule,
    OrdersModule,
    AnalyticsModule,
    QueueModule,
  ],
  providers: [EnvironmentValidator],
})
export class AppModule {}
