import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

type Window = { count: number; startedAt: number }

export const ANALYTICS_RATE_LIMITS = {
  windowMs: 60_000,
  maxPerVisitor: 12,
  maxTrackedVisitors: 1_000,
  maxGlobal: 3_000,
} as const

/** 进程内粗粒度限流：不记录 IP，限制匿名标识轮换，重启后自然清空。 */
@Injectable()
export class AnalyticsRateLimitService {
  private readonly windows = new Map<string, Window>()
  private globalWindow: Window = { count: 0, startedAt: 0 }

  check(visitorId: string, now = Date.now()): void {
    this.checkGlobalLimit(now)

    const current = this.windows.get(visitorId)
    if (!current || now - current.startedAt >= ANALYTICS_RATE_LIMITS.windowMs) {
      if (current) this.windows.delete(visitorId)
      this.makeRoomForVisitor()
      this.windows.set(visitorId, { count: 1, startedAt: now })
      return
    }
    if (current.count >= ANALYTICS_RATE_LIMITS.maxPerVisitor) {
      throw new HttpException('访问上报过于频繁', HttpStatus.TOO_MANY_REQUESTS)
    }
    current.count += 1
  }

  private checkGlobalLimit(now: number): void {
    if (
      this.globalWindow.startedAt === 0
      || now - this.globalWindow.startedAt >= ANALYTICS_RATE_LIMITS.windowMs
    ) {
      this.globalWindow = { count: 0, startedAt: now }
      this.pruneExpired(now)
    }
    if (this.globalWindow.count >= ANALYTICS_RATE_LIMITS.maxGlobal) {
      throw new HttpException('访问上报过于频繁', HttpStatus.TOO_MANY_REQUESTS)
    }
    this.globalWindow.count += 1
  }

  private pruneExpired(now: number): void {
    for (const [visitorId, window] of this.windows) {
      if (now - window.startedAt >= ANALYTICS_RATE_LIMITS.windowMs) {
        this.windows.delete(visitorId)
      }
    }
  }

  private makeRoomForVisitor(): void {
    if (this.windows.size < ANALYTICS_RATE_LIMITS.maxTrackedVisitors) return
    const oldestVisitorId = this.windows.keys().next().value
    if (oldestVisitorId) this.windows.delete(oldestVisitorId)
  }
}
