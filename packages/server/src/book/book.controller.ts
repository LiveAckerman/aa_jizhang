import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { BookService } from './book.service'
import { CreateBookDto } from './dto/create-book.dto'
import { UpdateBookDto } from './dto/update-book.dto'

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BookController {
  constructor(private readonly bookService: BookService) {}

  /** 创建账本 */
  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateBookDto) {
    const data = await this.bookService.create(userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /** 我的账本列表 */
  @Get()
  async list(@CurrentUser('sub') userId: string) {
    const data = await this.bookService.listMyBooks(userId)
    return { code: 0, message: 'ok', data }
  }

  /** 账本详情 */
  @Get(':id')
  async detail(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.bookService.detail(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 更新账本 */
  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
  ) {
    const data = await this.bookService.update(id, userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /** 删除账本 */
  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.bookService.remove(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 通过邀请码加入账本 */
  @Post('join/:code')
  async join(
    @CurrentUser('sub') userId: string,
    @Param('code') code: string,
    @Body('displayName') displayName?: string,
  ) {
    const data = await this.bookService.joinByCode(userId, code, displayName)
    return { code: 0, message: 'ok', data }
  }
}
