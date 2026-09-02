import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { ShareTokenService } from './share-token.service'
import { BookService } from '../book/book.service'
import { TransactionService } from '../transaction/transaction.service'

/**
 * 分享总结公开接口（无需登录）
 */
@Controller('share')
export class ShareSummaryController {
  constructor(
    private readonly shareTokenService: ShareTokenService,
    private readonly bookService: BookService,
    private readonly transactionService: TransactionService,
  ) {}

  /**
   * 获取分享总结数据（公开接口，仅需令牌）
   * @param tokenId 分享令牌 ID
   * @returns 账本基础信息 + 按配置聚合的账单统计
   */
  @Get('summary/:tokenId')
  async getSummary(@Param('tokenId') tokenId: string) {
    // 1. 验证令牌
    const token = await this.shareTokenService.verify(tokenId)

    // 2. 获取账本基础信息（脱敏：仅返回名称、封面、成员头像）
    const book = await this.bookService.getRaw(token.bookId)
    if (!book) {
      throw new NotFoundException('账本不存在')
    }

    const coverUrl = this.bookService.getCoverUrl(book)
    const members = await this.bookService.getMembers(token.bookId)

    // 3. 获取账单列表（公开场景取全部，可见性由令牌控制）
    const allTxs = await this.transactionService.listAll(token.bookId)

    // 4. 根据配置过滤账单
    const txs = token.config.includeUnsettled
      ? allTxs
      : allTxs.filter((t) => !!t.personSettledAt || !!t.settledRoundId)

    // 5. 根据 groupBy 聚合数据
    let groups: any[] = []
    const groupBy = token.config.groupBy

    if (groupBy === 'person') {
      // 按人聚合：统计每个人的支付总额
      const payerMap = new Map<string, { userId: string; nickname: string; avatar: string; totalAmount: number; count: number }>()

      txs.forEach((t) => {
        if (t.type === 'private') return // 私账不计入人员统计

        const key = t.payerId
        if (!payerMap.has(key)) {
          const member = members.find((m) => m.userId === key)
          payerMap.set(key, {
            userId: key,
            nickname: member?.nickname || '未知',
            avatar: member?.avatar || '',
            totalAmount: 0,
            count: 0,
          })
        }
        const item = payerMap.get(key)!
        item.totalAmount += t.amount
        item.count += 1
      })

      groups = Array.from(payerMap.values())
        .map((item) => ({
          ...item,
          totalAmountText: (item.totalAmount / 100).toFixed(2),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

    } else if (groupBy === 'category') {
      // 按分类聚合
      const catMap = new Map<string, { category: string; totalAmount: number; count: number }>()

      txs.forEach((t) => {
        const key = t.category || 'other'
        if (!catMap.has(key)) {
          catMap.set(key, { category: key, totalAmount: 0, count: 0 })
        }
        const item = catMap.get(key)!
        item.totalAmount += t.amount
        item.count += 1
      })

      groups = Array.from(catMap.values())
        .map((item) => ({
          ...item,
          totalAmountText: (item.totalAmount / 100).toFixed(2),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

    } else if (groupBy === 'paymentMethod') {
      // 按支付方式聚合
      const payMap = new Map<string, { paymentMethod: string; totalAmount: number; count: number }>()

      txs.forEach((t) => {
        const key = t.paymentMethod || 'wechat'
        if (!payMap.has(key)) {
          payMap.set(key, { paymentMethod: key, totalAmount: 0, count: 0 })
        }
        const item = payMap.get(key)!
        item.totalAmount += t.amount
        item.count += 1
      })

      groups = Array.from(payMap.values())
        .map((item) => ({
          ...item,
          totalAmountText: (item.totalAmount / 100).toFixed(2),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
    }

    // 6. 计算总金额
    const totalAmount = txs.reduce((sum, t) => sum + t.amount, 0)

    return {
      code: 0,
      message: 'ok',
      data: {
        book: {
          name: book.name,
          coverUrl,
          memberCount: members.length,
          members: members.map((m) => ({
            avatar: m.avatar,
            nickname: m.nickname,
          })),
        },
        config: token.config,
        summary: {
          totalAmount,
          totalAmountText: (totalAmount / 100).toFixed(2),
          txCount: txs.length,
        },
        groups,
        expiresAt: token.expiresAt,
      },
    }
  }
}
