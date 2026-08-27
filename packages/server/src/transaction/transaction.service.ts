import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Transaction } from './transaction.entity'
import { TransactionLog, FieldChange } from './transaction-log.entity'
import { TxShareSettlement } from '../settlement/tx-share-settlement.entity'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'
import { computeSplits } from './split.util'
import { BookService } from '../book/book.service'

/** 分类中文名，用于修改日志显示 */
const CATEGORY_LABEL: Record<string, string> = {
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

const SPLIT_METHOD_LABEL: Record<string, string> = {
  average: '平均分摊',
  ratio: '按比例',
  shares: '按份额',
  fixed: '指定金额',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  bankcard: '银行卡',
  cash: '现金',
  other: '其他',
}

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(TransactionLog)
    private readonly logRepo: Repository<TransactionLog>,
    @InjectRepository(TxShareSettlement)
    private readonly shareRepo: Repository<TxShareSettlement>,
    private readonly bookService: BookService,
  ) {}

  /** 组装分账明细：仅共享账需要 */
  private buildSplits(dto: CreateTransactionDto | UpdateTransactionDto, amount: number) {
    if (dto.type === 'private') return null
    const method = dto.splitMethod || 'average'
    return computeSplits(method, amount, dto.participantIds, dto.splits)
  }

  /** 分金额 → 元字符串 */
  private centToYuan(cent: number | null | undefined): string {
    if (cent == null) return '0.00'
    return (cent / 100).toFixed(2)
  }

  /** 创建账单 */
  async create(userId: string, dto: CreateTransactionDto) {
    await this.bookService.assertMember(dto.bookId, userId)

    const payerId = dto.type === 'private' ? userId : dto.payerId || userId
    const splits = this.buildSplits(dto, dto.amount)

    // 货币：CNY 时 originalAmount = amount, exchangeRate = 1
    const currency = (dto.currency || 'CNY').toUpperCase()
    const originalAmount =
      currency === 'CNY' ? dto.amount : dto.originalAmount ?? dto.amount
    const exchangeRate =
      currency === 'CNY'
        ? '1.000000'
        : dto.exchangeRate != null
          ? String(dto.exchangeRate)
          : null

    const tx = this.txRepo.create({
      bookId: dto.bookId,
      type: dto.type,
      amount: dto.amount,
      currency,
      originalAmount,
      exchangeRate,
      category: dto.category || 'other',
      paymentMethod: dto.paymentMethod || 'wechat',
      note: dto.note || '',
      payerId,
      creatorId: userId,
      splitMethod: dto.type === 'shared' ? dto.splitMethod || 'average' : 'average',
      splits,
      images: dto.images && dto.images.length ? dto.images : null,
      locationName: dto.locationName || '',
      locationAddress: dto.locationAddress || '',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      spentAt: dto.spentAt ? new Date(dto.spentAt) : new Date(),
    })
    await this.txRepo.save(tx)

    // 写创建日志
    await this.logRepo.save(
      this.logRepo.create({
        transactionId: tx.id,
        bookId: tx.bookId,
        userId,
        action: 'create',
        changes: null,
      }),
    )

    return tx
  }

  /**
   * 账本流水可见性规则：
   * - 私账：仅创建者本人可见
   * - 公账：仅「参与人（splits 里有份）」可见；付款人若未在 splits 里也算参与
   *   → 未参与该笔的成员看不到这条账单（如：甲乙一间房只甲乙分账，丙看不到）
   */
  async listByBook(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const rows = await this.txRepo.find({
      where: { bookId },
      order: { spentAt: 'DESC', createdAt: 'DESC' },
    })
    return rows.filter((t) => {
      if (t.type === 'private') return t.creatorId === userId
      // 公账：当前用户在 splits 参与人里，或是付款人
      const inSplits = (t.splits || []).some((s) => s.userId === userId)
      return inSplits || t.payerId === userId
    })
  }

  /**
   * 可部分结算的公账：与当前用户相关、未轮次结算、且仍存在跟当前用户相关的未结清份额。
   * 用于 settle-select 页，过滤掉「我这边已按人结清」的账单。
   *   - 我是付款人：还有其他参与人的份额未结清（别人还欠我）
   *   - 我是参与人：我自己那份未结清（我还欠付款人）
   */
  async settleableByBook(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const rows = await this.txRepo.find({
      where: { bookId },
      order: { spentAt: 'DESC', createdAt: 'DESC' },
    })

    // 按人结算已结清份额集合，键 = txId::debtorUserId
    const shares = await this.shareRepo.find({ where: { bookId } })
    const settledShare = new Set(
      shares.map((s) => `${s.transactionId}::${s.debtorUserId}`),
    )

    return rows.filter((t) => {
      if (t.type !== 'shared') return false
      if (t.settledRoundId || t.personSettledAt) return false
      const splits = t.splits || []
      if (t.payerId === userId) {
        // 我垫付：存在任一他人份额未结清 → 仍需结算
        return splits.some(
          (s) =>
            s.userId !== userId &&
            s.amount > 0 &&
            !settledShare.has(`${t.id}::${s.userId}`),
        )
      }
      // 我是参与人：我这份未结清 → 仍需结算
      const mine = splits.find((s) => s.userId === userId)
      if (!mine || mine.amount <= 0) return false
      return !settledShare.has(`${t.id}::${userId}`)
    })
  }

  async detail(id: string, userId: string) {
    const tx = await this.txRepo.findOne({ where: { id } })
    if (!tx) throw new NotFoundException('账单不存在')
    await this.bookService.assertMember(tx.bookId, userId)
    if (tx.type === 'private' && tx.creatorId !== userId) {
      throw new ForbiddenException('无权查看该私密账单')
    }
    return tx
  }

  /** 更新账单：仅创建者可改，同时写入字段变更日志 */
  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    const tx = await this.txRepo.findOne({ where: { id } })
    if (!tx) throw new NotFoundException('账单不存在')
    await this.bookService.assertMember(tx.bookId, userId)
    if (tx.creatorId !== userId) {
      throw new ForbiddenException('只有记录人可以修改该账单')
    }
    if (tx.settledRoundId != null) {
      throw new BadRequestException('该账单已在结算轮次中，请先删除结算轮次再编辑')
    }

    // 用来 diff 的旧值快照
    const before = {
      amount: tx.amount,
      currency: tx.currency,
      originalAmount: tx.originalAmount,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      note: tx.note,
      payerId: tx.payerId,
      splitMethod: tx.splitMethod,
      locationName: tx.locationName,
      spentAt: tx.spentAt,
      images: tx.images,
      type: tx.type,
    }

    if (dto.amount != null) tx.amount = dto.amount
    if (dto.type != null) tx.type = dto.type
    if (dto.category != null) tx.category = dto.category
    if (dto.paymentMethod != null) tx.paymentMethod = dto.paymentMethod
    if (dto.note != null) tx.note = dto.note
    if (dto.images != null) tx.images = dto.images.length ? dto.images : null
    if (dto.locationName != null) tx.locationName = dto.locationName
    if (dto.locationAddress != null) tx.locationAddress = dto.locationAddress
    if (dto.latitude !== undefined) tx.latitude = dto.latitude ?? null
    if (dto.longitude !== undefined) tx.longitude = dto.longitude ?? null
    if (dto.spentAt != null) tx.spentAt = new Date(dto.spentAt)

    // 货币相关字段
    if (dto.currency != null) {
      const currency = dto.currency.toUpperCase()
      tx.currency = currency
      if (currency === 'CNY') {
        tx.originalAmount = tx.amount
        tx.exchangeRate = '1.000000'
      }
    }
    if (dto.originalAmount != null) tx.originalAmount = dto.originalAmount
    if (dto.exchangeRate != null) tx.exchangeRate = String(dto.exchangeRate)

    if (tx.type === 'private') {
      tx.payerId = userId
      tx.splits = null
    } else {
      if (dto.payerId != null) tx.payerId = dto.payerId
      if (dto.splitMethod != null) tx.splitMethod = dto.splitMethod
      if (dto.splitMethod != null || dto.participantIds != null || dto.splits != null || dto.amount != null) {
        const participantIds =
          dto.participantIds ?? (tx.splits ? tx.splits.map((s) => s.userId) : undefined)
        const splits =
          dto.splits ??
          (tx.splits ? tx.splits.map((s) => ({ userId: s.userId, amount: s.amount, weight: s.weight })) : undefined)
        tx.splits = computeSplits(tx.splitMethod, tx.amount, participantIds, splits)
      }
    }

    await this.txRepo.save(tx)

    // 计算 diff 并写日志（仅在有实际变更时）
    const changes = this.diffChanges(before, tx)
    if (changes.length > 0) {
      await this.logRepo.save(
        this.logRepo.create({
          transactionId: tx.id,
          bookId: tx.bookId,
          userId,
          action: 'update',
          changes,
        }),
      )
    }

    return tx
  }

  /** 计算前后差异并生成字段级变更列表 */
  private diffChanges(before: any, tx: Transaction): FieldChange[] {
    const changes: FieldChange[] = []
    if (before.amount !== tx.amount) {
      changes.push({
        field: 'amount',
        label: '支付金额',
        oldValue: this.centToYuan(before.amount),
        newValue: this.centToYuan(tx.amount),
      })
    }
    if (before.currency !== tx.currency) {
      changes.push({
        field: 'currency',
        label: '结算货币',
        oldValue: before.currency || 'CNY',
        newValue: tx.currency,
      })
    }
    if (before.category !== tx.category) {
      changes.push({
        field: 'category',
        label: '分类',
        oldValue: CATEGORY_LABEL[before.category] || before.category || '',
        newValue: CATEGORY_LABEL[tx.category] || tx.category,
      })
    }
    if (before.paymentMethod !== tx.paymentMethod) {
      changes.push({
        field: 'paymentMethod',
        label: '支付方式',
        oldValue:
          PAYMENT_METHOD_LABEL[before.paymentMethod] ||
          before.paymentMethod ||
          '',
        newValue: PAYMENT_METHOD_LABEL[tx.paymentMethod] || tx.paymentMethod,
      })
    }
    if (before.note !== tx.note) {
      changes.push({
        field: 'note',
        label: '备注',
        oldValue: before.note || '',
        newValue: tx.note || '',
      })
    }
    if (before.payerId !== tx.payerId) {
      changes.push({
        field: 'payerId',
        label: '付款人',
        oldValue: before.payerId || '',
        newValue: tx.payerId,
      })
    }
    if (before.splitMethod !== tx.splitMethod) {
      changes.push({
        field: 'splitMethod',
        label: '分账方式',
        oldValue: SPLIT_METHOD_LABEL[before.splitMethod] || before.splitMethod || '',
        newValue: SPLIT_METHOD_LABEL[tx.splitMethod] || tx.splitMethod,
      })
    }
    if (before.locationName !== tx.locationName) {
      changes.push({
        field: 'locationName',
        label: '地点',
        oldValue: before.locationName || '',
        newValue: tx.locationName || '',
      })
    }
    const beforeSpent = before.spentAt instanceof Date ? before.spentAt.toISOString() : String(before.spentAt || '')
    const afterSpent = tx.spentAt instanceof Date ? tx.spentAt.toISOString() : String(tx.spentAt || '')
    if (beforeSpent !== afterSpent) {
      changes.push({
        field: 'spentAt',
        label: '消费时间',
        oldValue: beforeSpent.slice(0, 10),
        newValue: afterSpent.slice(0, 10),
      })
    }
    const beforeImgs = Array.isArray(before.images) ? before.images.length : 0
    const afterImgs = Array.isArray(tx.images) ? tx.images.length : 0
    if (beforeImgs !== afterImgs) {
      changes.push({
        field: 'images',
        label: '凭证图片',
        oldValue: `${beforeImgs} 张`,
        newValue: `${afterImgs} 张`,
      })
    }
    if (before.type !== tx.type) {
      changes.push({
        field: 'type',
        label: '账单类型',
        oldValue: before.type === 'private' ? '私密账' : '共享账',
        newValue: tx.type === 'private' ? '私密账' : '共享账',
      })
    }
    return changes
  }

  async remove(id: string, userId: string) {
    const tx = await this.txRepo.findOne({ where: { id } })
    if (!tx) throw new NotFoundException('账单不存在')
    await this.bookService.assertMember(tx.bookId, userId)
    if (tx.creatorId !== userId) {
      throw new ForbiddenException('只有记录人可以删除该账单')
    }
    if (tx.settledRoundId != null) {
      throw new BadRequestException('该账单已结算，请先撤销结算再删除')
    }
    await this.logRepo.delete({ transactionId: id })
    await this.txRepo.delete({ id })
    return { deleted: true }
  }

  /**
   * 账单修改记录列表：
   * - 账单创建者可见
   * - 共享账的成员也可见（了解协作历史）
   * - 私密账仅创建者可见
   */
  async listLogs(transactionId: string, userId: string) {
    const tx = await this.txRepo.findOne({ where: { id: transactionId } })
    if (!tx) throw new NotFoundException('账单不存在')
    await this.bookService.assertMember(tx.bookId, userId)
    if (tx.type === 'private' && tx.creatorId !== userId) {
      throw new ForbiddenException('无权查看该账单的修改记录')
    }
    return this.logRepo.find({
      where: { transactionId },
      order: { createdAt: 'DESC' },
    })
  }

  async summary(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const rows = await this.txRepo.find({ where: { bookId } })

    // 按人结算已结清的份额集合，键 = txId::debtorUserId（这些份额不再计入待收/待付）
    const shares = await this.shareRepo.find({ where: { bookId } })
    const settledShare = new Set(
      shares.map((s) => `${s.transactionId}::${s.debtorUserId}`),
    )

    // sharedTotal：仅累加「当前用户参与」的公账整笔金额（每人看到的公账不同）
    let sharedTotal = 0
    let myShared = 0
    let myPrivate = 0
    // 未结算公账的净头寸：付款方视角 +（垫付他人份额），参与方视角 -（自己应付份额）
    let netBalance = 0

    for (const t of rows) {
      if (t.type === 'shared') {
        const mine = (t.splits || []).find((s) => s.userId === userId)
        const involved = !!mine || t.payerId === userId
        if (!involved) continue // 未参与的公账不计入该用户的任何统计
        sharedTotal += t.amount
        if (mine) myShared += mine.amount

        // 计入净头寸：排除轮次结算，且按份额排除已按人结清的部分
        if (!t.settledRoundId && !t.personSettledAt) {
          if (t.payerId === userId) {
            // 我垫付：每个「未结清」的他人份额都欠我 → 累加
            for (const s of t.splits || []) {
              if (s.userId === userId) continue // 自己那份不算欠款
              if (settledShare.has(`${t.id}::${s.userId}`)) continue // 已结清
              netBalance += s.amount
            }
          } else if (mine) {
            // 我是参与人：我这份若未结清 → 我欠付款人
            if (!settledShare.has(`${t.id}::${userId}`)) {
              netBalance -= mine.amount
            }
          }
        }
      } else if (t.creatorId === userId) {
        myPrivate += t.amount
      }
    }

    return {
      sharedTotal,
      myShared,
      myPrivate,
      myTotal: myShared + myPrivate,
      // netBalance > 0 → 待收款；< 0 → 待支付（绝对值）
      netBalance,
      pendingReceive: netBalance > 0 ? netBalance : 0,
      pendingPay: netBalance < 0 ? -netBalance : 0,
    }
  }
}
