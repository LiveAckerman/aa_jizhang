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
  ) {
    const allowedRange: StatsRange[] = ['month', '3m', 'year', 'all']
    const allowedScope: StatsScope[] = ['mine', 'team']
    const r = allowedRange.includes(range) ? range : 'month'
    const s = allowedScope.includes(scope) ? scope : 'mine'
    const data = await this.svc.overview(userId, r, s)
    return { code: 0, message: 'ok', data }
  }
}
