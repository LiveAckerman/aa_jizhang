import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'
import { CreateAppVisitDto } from './dto/create-app-visit.dto'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('app-visits')
  @UseGuards(OptionalJwtAuthGuard)
  async createAppVisit(
    @Body() dto: CreateAppVisitDto,
    @Req() request: { user?: { sub?: string } },
    @Res({ passthrough: true }) response: { status(code: number): unknown },
  ) {
    const data = await this.analyticsService.recordVisit(dto.eventId, dto.visitorId, request.user?.sub)
    response.status(data.recorded ? 201 : 200)
    return { code: 0, message: 'ok', data }
  }
}
