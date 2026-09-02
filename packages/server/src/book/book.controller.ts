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
  BadRequestException,
} from '@nestjs/common'
import { Res } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { WechatService } from '../auth/wechat.service'
import { BookService } from './book.service'
import { CreateBookDto } from './dto/create-book.dto'
import { UpdateBookDto } from './dto/update-book.dto'
import { ShareTokenService } from '../share-token/share-token.service'
import { TransactionService } from '../transaction/transaction.service'

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BookController {
  constructor(
    private readonly bookService: BookService,
    private readonly wechatService: WechatService,
    private readonly shareTokenService: ShareTokenService,
    private readonly transactionService: TransactionService,
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

  /**
   * 创建账本总结分享令牌
   * @param userId 当前用户 ID
   * @param id 账本 ID
   * @param body 分享配置
   * @returns 分享令牌 ID 和完整 URL
   */
  @Post(':id/share-token')
  async createShareToken(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: { groupBy: 'person' | 'category' | 'paymentMethod'; includeUnsettled: boolean },
  ) {
    // 必须是成员才能分享
    await this.bookService.assertMember(id, userId)

    const token = await this.shareTokenService.create(id, {
      groupBy: body.groupBy,
      includeUnsettled: body.includeUnsettled,
    })

    // 构造小程序页面路径（用于生成二维码）
    const path = `/packageA/pages/share-summary/share-summary?token=${token.id}`

    return {
      code: 0,
      message: 'ok',
      data: {
        tokenId: token.id,
        path,
        expiresAt: token.expiresAt,
      }
    }
  }

  /**
   * 生成分享总结小程序码
   * @param userId 当前用户 ID
   * @param id 账本 ID
   * @param tokenId 分享令牌 ID（query 参数）
   * @param res Response 对象
   * @returns PNG 图片流
   */
  @Get(':id/share-qrcode')
  async shareQrcode(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('tokenId') tokenId: string,
    @Res() res: any,
  ) {
    // 验证令牌有效性
    const token = await this.shareTokenService.verify(tokenId)

    // 验证令牌归属账本
    if (token.bookId !== id) {
      throw new BadRequestException('令牌与账本不匹配')
    }

    // 必须是成员才能生成分享码
    await this.bookService.assertMember(id, userId)

    // 生成小程序码：scene 携带 tokenId
    const buffer = await this.wechatService.getUnlimitedQRCode(
      `t=${tokenId}`,
      'packageA/pages/share-summary/share-summary',
    )

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buffer)
  }
}
