import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { SettlementService } from './settlement.service'
import { CreateSettlementDto } from './dto/create-settlement.dto'

@Controller('settlements')
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * 计算账本的结算方案（实时计算）
   * GET /api/settlements/calculate?bookId=xxx
   */
  @Get('calculate')
  async calculate(
    @CurrentUser('sub') userId: string,
    @Query('bookId') bookId: string,
  ) {
    const data = await this.settlementService.calculate(bookId, userId)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 创建结算记录
   * POST /api/settlements
   */
  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    const data = await this.settlementService.create(userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 查询账本的结算记录列表
   * GET /api/settlements?bookId=xxx
   */
  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query('bookId') bookId: string,
  ) {
    const data = await this.settlementService.list(bookId, userId)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 标记结算完成
   * PATCH /api/settlements/:id/complete
   */
  @Patch(':id/complete')
  async complete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const data = await this.settlementService.complete(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 删除结算记录
   * DELETE /api/settlements/:id
   */
  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.settlementService.remove(id, userId)
    return { code: 0, message: 'ok', data }
  }
}
