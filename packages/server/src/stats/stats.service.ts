import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { BookMember } from '../book/book-member.entity'
import { Transaction } from '../transaction/transaction.entity'

export type StatsRange = 'month' | '3m' | 'year' | 'all'
export type StatsScope = 'mine' | 'team'

/** 分类名称映射（后端也需要，避免依赖前端） */
const CATEGORY_NAMES: Record<string, string> = {
  food: '餐饮',
  transport: '交通',
  hotel: '住宿',
  ticket: '门票',
  shopping: '购物',
  entertainment: '娱乐',
  drink: '饮品',
  medical: '医疗',
  other: '其他',
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(BookMember)
    private readonly memberRepo: Repository<BookMember>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  /**
   * 跨账本统计
   *   mine  → 我承担的金额（共享账取我在 splits 里的份额；私密账取我作为 creator 的全额）
   *   team  → 我参与的所有账本里，所有共享账单的总额（团队开销全景，不含私密）
   */
  async overview(userId: string, range: StatsRange, scope: StatsScope) {
    // 1. 拉出我参与的账本
    const members = await this.memberRepo.find({ where: { userId } })
    const bookIds = members.map((m) => m.bookId)
    if (bookIds.length === 0) {
      return this.emptyResult(range)
    }

    // 2. 时间范围
    const { start, end, prevStart, prevEnd } = this.calcRange(range)

    // 3. 一次拉所有账单（数据量不大，简单实现；后续可加时间下限过滤）
    const allTxs = await this.txRepo.find({
      where: { bookId: In(bookIds) },
    })

    // 4. 按范围过滤 + 按 scope 计算金额
    const inRange = allTxs.filter((t) => {
      const at = new Date(t.spentAt).getTime()
      return at >= (start ? start.getTime() : 0) && at < end.getTime()
    })
    const inPrev = allTxs.filter((t) => {
      if (!prevStart || !prevEnd) return false
      const at = new Date(t.spentAt).getTime()
      return at >= prevStart.getTime() && at < prevEnd.getTime()
    })

    const amountOf = (t: Transaction) => this.amountForScope(t, userId, scope)

    let total = 0
    let count = 0
    const categoryMap = new Map<string, number>() // key -> amount (fen)
    for (const t of inRange) {
      const amt = amountOf(t)
      if (amt <= 0) continue
      total += amt
      count += 1
      categoryMap.set(t.category || 'other', (categoryMap.get(t.category || 'other') || 0) + amt)
    }

    let prevTotal = 0
    for (const t of inPrev) prevTotal += amountOf(t)

    // 5. 分类 top 5（其它归入"其他"）
    const catEntries = [...categoryMap.entries()]
      .map(([key, amount]) => ({ key, name: CATEGORY_NAMES[key] || key, amount }))
      .sort((a, b) => b.amount - a.amount)
    const top = catEntries.slice(0, 5)
    const restSum = catEntries.slice(5).reduce((s, x) => s + x.amount, 0)
    if (restSum > 0) {
      // 若已经存在 other，则合并
      const otherIdx = top.findIndex((x) => x.key === 'other')
      if (otherIdx >= 0) {
        top[otherIdx].amount += restSum
      } else {
        top.push({ key: '_rest', name: '其他', amount: restSum })
      }
    }
    const catTotal = top.reduce((s, x) => s + x.amount, 0) || 1
    const categories = top.map((x) => ({
      ...x,
      pct: Math.round((x.amount / catTotal) * 1000) / 10, // 百分比保留 1 位
    }))

    // 6. 近 6 月柱状
    const monthly = this.buildMonthly(allTxs, amountOf)

    return {
      range,
      scope,
      total,
      count,
      prevTotal,
      prevDelta: prevTotal === 0 ? null : Math.round(((total - prevTotal) / prevTotal) * 1000) / 10,
      categories,
      monthly,
    }
  }

  private amountForScope(t: Transaction, userId: string, scope: StatsScope): number {
    if (scope === 'team') {
      return t.type === 'shared' ? t.amount : 0
    }
    // mine
    if (t.type === 'shared') {
      const mine = (t.splits || []).find((s) => s.userId === userId)
      return mine ? mine.amount : 0
    }
    return t.creatorId === userId ? t.amount : 0
  }

  private calcRange(range: StatsRange) {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) // 到今天 24:00
    let start: Date | null = null
    let prevStart: Date | null = null
    let prevEnd: Date | null = null
    if (range === 'month') {
      start = this.startOfMonth(now)
      prevEnd = start
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
    } else if (range === '3m') {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      prevEnd = start
      prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1)
    } else if (range === 'year') {
      start = new Date(now.getFullYear(), 0, 1)
      prevEnd = start
      prevStart = new Date(start.getFullYear() - 1, 0, 1)
    } else {
      start = new Date(2000, 0, 1)
    }
    return { start, end, prevStart, prevEnd }
  }

  private startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }

  private buildMonthly(txs: Transaction[], amountOf: (t: Transaction) => number) {
    const now = new Date()
    const buckets: { ym: string; amount: number; label: string }[] = []
    const idxOf = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      idxOf.set(ym, buckets.length)
      buckets.push({ ym, amount: 0, label: `${d.getMonth() + 1}月` })
    }
    for (const t of txs) {
      const d = new Date(t.spentAt)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const idx = idxOf.get(ym)
      if (idx === undefined) continue
      buckets[idx].amount += amountOf(t)
    }
    return buckets
  }

  private emptyResult(range: StatsRange) {
    const monthly: { ym: string; amount: number; label: string }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthly.push({
        ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        amount: 0,
        label: `${d.getMonth() + 1}月`,
      })
    }
    return { range, scope: 'mine', total: 0, count: 0, prevTotal: 0, prevDelta: null, categories: [], monthly }
  }
}
