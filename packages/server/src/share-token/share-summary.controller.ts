import { Controller, Get, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common'
import { ShareTokenService } from './share-token.service'
import { BookService } from '../book/book.service'
import { TransactionService } from '../transaction/transaction.service'
import { SettlementService } from '../settlement/settlement.service'

/**
 * 分享总结公开接口（无需登录）
 */
@Controller('share')
export class ShareSummaryController {
  constructor(
    private readonly shareTokenService: ShareTokenService,
    private readonly bookService: BookService,
    private readonly transactionService: TransactionService,
    private readonly settlementService: SettlementService,
  ) {}

  /**
   * 获取分享总结数据（公开接口，仅需令牌）
   * @param tokenId 分享令牌 ID
   * @param groupBy 可选：覆盖令牌里的统计维度（前端切换用）
   * @param includeUnsettled 可选：覆盖令牌里的结算筛选（前端切换用）
   * @returns 账本基础信息 + 按配置聚合的账单统计
   */
  @Get('summary/:tokenId')
  async getSummary(
    @Param('tokenId') tokenId: string,
    @Query('groupBy') groupByQuery?: string,
    @Query('includeUnsettled') includeUnsettledQuery?: string,
  ) {
    // 1. 验证令牌
    const token = await this.shareTokenService.verify(tokenId)

    // 令牌只用于鉴权（限定 bookId），统计维度/结算筛选允许前端 query 覆盖，
    // 这样切换维度不需要每次都重新生成令牌
    const validGroupBy = ['person', 'category', 'paymentMethod']
    const groupBy = validGroupBy.includes(groupByQuery || '')
      ? (groupByQuery as 'person' | 'category' | 'paymentMethod')
      : token.config.groupBy
    const includeUnsettled =
      includeUnsettledQuery != null
        ? includeUnsettledQuery === 'true' || includeUnsettledQuery === '1'
        : token.config.includeUnsettled

    // 2. 获取账本基础信息（脱敏：仅返回名称、封面、成员头像）
    const book = await this.bookService.getRaw(token.bookId)
    if (!book) {
      throw new NotFoundException('账本不存在')
    }

    const coverUrl = this.bookService.getCoverUrl(book)
    const members = await this.bookService.getMembers(token.bookId)

    // 3. 获取账单列表（公开场景取全部，可见性由令牌控制）
    const allTxs = await this.transactionService.listAll(token.bookId)

    // 4. 获取进行中的结算轮次（用于判断"已结算"）
    // 注意：由于是公开接口，无法调用需要 userId 的方法，这里直接查询数据库
    const activeRounds = await this.settlementService.getActiveRoundsPublic(token.bookId)
    const activeRoundIds = new Set(activeRounds.map((r) => r.id))

    // 5. 根据配置过滤账单
    const isSettled = (t: any) =>
      !!t.personSettledAt || (!!t.settledRoundId && !activeRoundIds.has(t.settledRoundId))

    const txs = includeUnsettled
      ? allTxs.filter((t) => t.type !== 'private') // 排除私账
      : allTxs.filter((t) => t.type !== 'private' && isSettled(t))

    // 6. 根据 groupBy 聚合数据
    let groups: any[] = []

    if (groupBy === 'person') {
      // 按人聚合：统计每个人在所有账单中的消费份额总和（splits）
      const personMap = new Map<
        string,
        {
          userId: string
          nickname: string
          avatar: string
          totalAmount: number
          count: number
          transactions: any[]
        }
      >()

      txs.forEach((t) => {
        // 遍历每笔账单的 splits，累加每个人的份额
        if (t.splits && t.splits.length > 0) {
          t.splits.forEach((split: any) => {
            const key = split.userId
            if (!personMap.has(key)) {
              const member = members.find((m) => m.userId === key)
              personMap.set(key, {
                userId: key,
                nickname: member?.nickname || '未知',
                avatar: member?.avatar || '',
                totalAmount: 0,
                count: 0,
                transactions: [],
              })
            }
            const item = personMap.get(key)!
            item.totalAmount += split.amount
            item.count += 1
            item.transactions.push(t)
          })
        }
      })

      groups = Array.from(personMap.values())
        .map((item) => ({
          key: item.userId,
          userId: item.userId,
          nickname: item.nickname,
          avatar: item.avatar,
          totalAmount: item.totalAmount,
          totalAmountText: (item.totalAmount / 100).toFixed(2),
          count: item.count,
          transactions: this.decorateTransactions(item.transactions),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
    } else if (groupBy === 'category') {
      // 按分类聚合
      const catMap = new Map<
        string,
        { category: string; totalAmount: number; count: number; transactions: any[] }
      >()

      txs.forEach((t) => {
        const key = t.category || 'other'
        if (!catMap.has(key)) {
          catMap.set(key, { category: key, totalAmount: 0, count: 0, transactions: [] })
        }
        const item = catMap.get(key)!
        item.totalAmount += t.amount
        item.count += 1
        item.transactions.push(t)
      })

      groups = Array.from(catMap.values())
        .map((item) => ({
          key: item.category,
          category: item.category,
          totalAmount: item.totalAmount,
          totalAmountText: (item.totalAmount / 100).toFixed(2),
          count: item.count,
          transactions: this.decorateTransactions(item.transactions),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
    } else if (groupBy === 'paymentMethod') {
      // 按支付方式聚合
      const payMap = new Map<
        string,
        { paymentMethod: string; totalAmount: number; count: number; transactions: any[] }
      >()

      txs.forEach((t) => {
        const key = t.paymentMethod || 'wechat'
        if (!payMap.has(key)) {
          payMap.set(key, { paymentMethod: key, totalAmount: 0, count: 0, transactions: [] })
        }
        const item = payMap.get(key)!
        item.totalAmount += t.amount
        item.count += 1
        item.transactions.push(t)
      })

      groups = Array.from(payMap.values())
        .map((item) => ({
          key: item.paymentMethod,
          paymentMethod: item.paymentMethod,
          totalAmount: item.totalAmount,
          totalAmountText: (item.totalAmount / 100).toFixed(2),
          count: item.count,
          transactions: this.decorateTransactions(item.transactions),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
    }

    // 7. 计算总金额
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
        config: { groupBy, includeUnsettled },
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

  /**
   * 装饰账单明细，添加前端需要的字段
   */
  private decorateTransactions(txs: any[]): any[] {
    // 分类映射（前端常量）
    const CATEGORY_MAP: Record<string, string> = {
      food: '餐饮',
      transport: '交通',
      hotel: '住宿',
      shopping: '购物',
      entertainment: '娱乐',
      medical: '医疗',
      education: '教育',
      other: '其他',
    }

    return txs.map((t) => ({
      id: t.id,
      note: t.note || '',
      amount: t.amount,
      amountText: (t.amount / 100).toFixed(2),
      category: t.category,
      categoryName: CATEGORY_MAP[t.category] || '其他',
      paymentMethod: t.paymentMethod,
      spentAt: this.formatDate(new Date(t.spentAt)),
      type: t.type,
    }))
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}
