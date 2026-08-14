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
import { TransactionService } from './transaction.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly txService: TransactionService) {}

  /** 记一笔 */
  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    const data = await this.txService.create(userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /** 账本流水列表 */
  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query('bookId') bookId: string,
  ) {
    const data = await this.txService.listByBook(bookId, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 账本汇总（含我的共享/私密拆分） */
  @Get('summary')
  async summary(
    @CurrentUser('sub') userId: string,
    @Query('bookId') bookId: string,
  ) {
    const data = await this.txService.summary(bookId, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 账单修改记录 */
  @Get(':id/logs')
  async logs(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.txService.listLogs(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 账单详情 */
  @Get(':id')
  async detail(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.txService.detail(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 更新账单 */
  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    const data = await this.txService.update(id, userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /** 删除账单 */
  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.txService.remove(id, userId)
    return { code: 0, message: 'ok', data }
  }
}
