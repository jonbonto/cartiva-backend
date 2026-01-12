import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  exports: [],
})
export class AnalyticsModule {}
