import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ExchangeRateService } from './exchange-rate.service'

@Controller('exchange-rates')
@UseGuards(JwtAuthGuard)
export class ExchangeRateController {
  constructor(private readonly svc: ExchangeRateService) {}

  /** 获取汇率表（1 单位目标币 = ? CNY） */
  @Get()
  async list() {
    const data = await this.svc.getRates()
    return { code: 0, message: 'ok', data }
  }
}
