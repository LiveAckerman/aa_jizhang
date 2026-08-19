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
import { BatchCreateSettlementDto } from './dto/batch-create-settlement.dto'
import { SettleDto } from './dto/settle.dto'

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
   * 执行结算（全部/部分）
   * POST /api/settlements/settle
   */
  @Post('settle')
  async settle(@CurrentUser('sub') userId: string, @Body() dto: SettleDto) {
    const data = await this.settlementService.settle(userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 部分结算预览
   * POST /api/settlements/preview-partial
   */
  @Post('preview-partial')
  async previewPartial(
    @CurrentUser('sub') userId: string,
    @Body() body: { bookId: string; txIds: string[] },
  ) {
    const data = await this.settlementService.previewPartial(
      body.bookId,
      userId,
      body.txIds,
    )
    return { code: 0, message: 'ok', data }
  }

  /**
   * 结算轮次列表
   * GET /api/settlements/rounds?bookId=xxx
   */
  @Get('rounds')
  async listRounds(
    @CurrentUser('sub') userId: string,
    @Query('bookId') bookId: string,
  ) {
    const data = await this.settlementService.listRounds(bookId, userId)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 撤销某一轮结算
   * POST /api/settlements/rounds/:id/revert
   */
  @Post('rounds/:id/revert')
  async revertRound(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const data = await this.settlementService.revertRound(id, userId)
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
   * 撤回单条已完成结算
   * PATCH /api/settlements/:id/revert
   */
  @Patch(':id/revert')
  async revert(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.settlementService.revert(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /**
   * 按成员撤回已完成结算（targetUserId 为空则撤回该账本全部）
   * POST /api/settlements/revert-by-user
   */
  @Post('revert-by-user')
  async revertByUser(
    @CurrentUser('sub') userId: string,
    @Body() body: { bookId: string; targetUserId?: string },
  ) {
    const data = await this.settlementService.revertByUser(
      body.bookId,
      userId,
      body.targetUserId,
    )
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

  /**
   * 批量创建并完成结算记录（使用事务）
   * POST /api/settlements/batch
   */
  @Post('batch')
  async batchCreate(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchCreateSettlementDto,
  ) {
    const data = await this.settlementService.batchCreateAndComplete(userId, dto)
    return { code: 0, message: 'ok', data }
  }
}
