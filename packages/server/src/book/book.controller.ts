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
import { Res } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { WechatService } from '../auth/wechat.service'
import { BookService } from './book.service'
import { CreateBookDto } from './dto/create-book.dto'
import { UpdateBookDto } from './dto/update-book.dto'

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BookController {
  constructor(
    private readonly bookService: BookService,
    private readonly wechatService: WechatService,
  ) {}

  /** 创建账本 */
  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateBookDto) {
    const data = await this.bookService.create(userId, dto)
    return { code: 0, message: 'ok', data }
  }

  /** 我的账本列表（可按分组筛选） */
  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query('groupId') groupId?: string,
  ) {
    const data = await this.bookService.listMyBooks(userId, groupId)
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

  /** 邀请码预览账本信息（加入前展示，需登录） */
  @Get('invite/:code')
  async inviteInfo(
    @CurrentUser('sub') userId: string,
    @Param('code') code: string,
  ) {
    const data = await this.bookService.infoByCode(code, userId)
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

  /** 移除成员（仅 owner） */
  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser('sub') ownerId: string,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const data = await this.bookService.removeMember(id, ownerId, targetUserId)
    return { code: 0, message: 'ok', data }
  }

  /** 退出账本（成员本人） */
  @Post(':id/leave')
  async leave(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.bookService.leave(id, userId)
    return { code: 0, message: 'ok', data }
  }

  /** 复制账本 */
  @Post(':id/copy')
  async copy(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; copyMembers?: boolean },
  ) {
    const data = await this.bookService.copy(
      userId,
      id,
      body?.name || '',
      !!body?.copyMembers,
    )
    return { code: 0, message: 'ok', data }
  }

  /**
   * 生成账本邀请小程序码（扫码加入）。
   * 返回 image/png，scene 携带邀请码，扫码进入 pages/join/join。
   */
  @Get(':id/qrcode')
  async qrcode(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    // 必须是成员才能生成邀请码
    await this.bookService.assertMember(id, userId)
    const book = await this.bookService.getRaw(id)
    const buffer = await this.wechatService.getUnlimitedQRCode(
      `c=${book.inviteCode}`,
      'pages/join/join',
    )
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buffer)
  }
}
