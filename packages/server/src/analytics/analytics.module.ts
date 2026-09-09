import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsRateLimitService } from './analytics-rate-limit.service'
import { AnalyticsService } from './analytics.service'
import { AppVisitEvent } from './app-visit-event.entity'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

@Module({
  imports: [TypeOrmModule.forFeature([AppVisitEvent])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRateLimitService, OptionalJwtAuthGuard],
})
export class AnalyticsModule {}
