import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { QueryFailedError, Repository } from 'typeorm'
import { AppVisitEvent } from './app-visit-event.entity'
import { AnalyticsRateLimitService } from './analytics-rate-limit.service'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AppVisitEvent)
    private readonly visits: Repository<AppVisitEvent>,
    private readonly rateLimit: AnalyticsRateLimitService,
  ) {}

  async recordVisit(eventId: string, visitorId: string, userId?: string): Promise<{ recorded: boolean }> {
    this.rateLimit.check(visitorId)
    try {
      await this.visits.insert({
        id: eventId,
        visitorId,
        userId: userId || null,
      })
      return { recorded: true }
    } catch (error) {
      // PostgreSQL unique_violation: eventId 已成功落库，只是客户端没有收到响应。
      if (error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        return { recorded: false }
      }
      throw error
    }
  }
}
