import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { StatsService, StatsRange, StatsScope } from './stats.service'

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get('overview')
  async overview(
    @CurrentUser('sub') userId: string,
    @Query('range') range: StatsRange = 'month',
    @Query('scope') scope: StatsScope = 'mine',
    @Query('bookId') bookId?: string,
  ) {
    const allowedRange: StatsRange[] = ['month', '3m', 'year', 'all']
    const allowedScope: StatsScope[] = ['mine', 'team']
    const r = allowedRange.includes(range) ? range : 'month'
    const s = allowedScope.includes(scope) ? scope : 'mine'
    const bid = bookId && bookId !== 'all' ? bookId : undefined
    const data = await this.svc.overview(userId, r, s, bid)
    return { code: 0, message: 'ok', data }
  }
}
