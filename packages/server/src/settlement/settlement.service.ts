import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, IsNull, In } from 'typeorm'
import { Settlement } from './settlement.entity'
import { SettlementRound } from './settlement-round.entity'
import { TxShareSettlement } from './tx-share-settlement.entity'
import { Transaction } from '../transaction/transaction.entity'
import { BookMember } from '../book/book-member.entity'
import { BookService } from '../book/book.service'
import { CreateSettlementDto } from './dto/create-settlement.dto'
import { BatchCreateSettlementDto } from './dto/batch-create-settlement.dto'
import { SettleDto } from './dto/settle.dto'
import { calculateBalances, calculateOptimalSettlement } from './settlement.algorithm'

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SettlementRound)
    private readonly roundRepo: Repository<SettlementRound>,
    @InjectRepository(TxShareSettlement)
    private readonly shareRepo: Repository<TxShareSettlement>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(BookMember)
    private readonly memberRepo: Repository<BookMember>,
    private readonly bookService: BookService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 按人结算明细：当前用户与账本内每个人的两两净额 + 构成明细。
   * 显示按净额抵扣，结清追踪落在账单份额（TxShareSettlement）粒度。
   * @param roundId 轮次模式：只算该轮账单，份额结清归属该轮；为空则全部账单模式。
   */
  async byPerson(bookId: string, userId: string, roundId?: string) {
    await this.bookService.assertMember(bookId, userId)

    // 1. 账单范围：轮次模式取该轮账单；全部模式取未入轮次且未整笔结清的账单
    const txWhere: any = { bookId, type: 'shared' }
    if (roundId) {
      txWhere.settledRoundId = roundId
    } else {
      txWhere.settledRoundId = IsNull()
      txWhere.personSettledAt = IsNull()
    }
    const txs = await this.txRepo.find({ where: txWhere })

    // 2. 该范围内已结清的份额集合（按 roundId 过滤），键 = txId::debtorUserId
    const shareWhere: any = { bookId }
    shareWhere.roundId = roundId ? roundId : IsNull()
    const shares = await this.shareRepo.find({ where: shareWhere })
    const settledSet = new Set(
      shares.map((s) => `${s.transactionId}::${s.debtorUserId}`),
    )

    // 3. 成员映射（头像昵称）
    const book = await this.bookService.detail(bookId, userId)
    const memberMap = new Map<string, { nickname: string; avatar: string }>()
    ;(book.members || []).forEach((m: any) =>
      memberMap.set(m.userId, {
        nickname: m.nickname || '成员',
        avatar: m.avatar || '',
      }),
    )
    const nameOf = (uid: string) =>
      memberMap.get(uid) || { nickname: '成员', avatar: '' }

    // 4. 遍历账单，构造与「我」相关的债务单元（含已结清标记）
    //    they_owe：我是付款人、对方欠我；i_owe：对方是付款人、我欠对方
    type Unit = {
      otherUserId: string
      amount: number
      direction: 'they_owe' | 'i_owe'
      txId: string
      note: string
      category: string
      spentAt: Date
      settled: boolean
    }
    const units: Unit[] = []
    for (const t of txs) {
      const splits = t.splits || []
      if (t.payerId === userId) {
        for (const s of splits) {
          if (s.userId === userId || s.amount <= 0) continue
          units.push({
            otherUserId: s.userId,
            amount: s.amount,
            direction: 'they_owe',
            txId: t.id,
            note: t.note,
            category: t.category,
            spentAt: t.spentAt,
            settled: settledSet.has(`${t.id}::${s.userId}`),
          })
        }
      } else {
        const mine = splits.find((s) => s.userId === userId)
        if (!mine || mine.amount <= 0) continue
        units.push({
          otherUserId: t.payerId,
          amount: mine.amount,
          direction: 'i_owe',
          txId: t.id,
          note: t.note,
          category: t.category,
          spentAt: t.spentAt,
          settled: settledSet.has(`${t.id}::${userId}`),
        })
      }
    }

    // 5. 按对方聚合。区分「未结清净额」与「已结清对」
    const byOther = new Map<string, Unit[]>()
    units.forEach((u) => {
      if (!byOther.has(u.otherUserId)) byOther.set(u.otherUserId, [])
      byOther.get(u.otherUserId)!.push(u)
    })

    const receivables: any[] = [] // 未结清：对方需转我
    const payables: any[] = []    // 未结清：我需转对方
    const settledList: any[] = [] // 已结清对（可撤回）

    const buildDetails = (list: Unit[]) =>
      list
        .slice()
        .sort((a, b) => +new Date(b.spentAt) - +new Date(a.spentAt))
        .map((u) => ({
          txId: u.txId,
          note: u.note,
          category: u.category,
          spentAt: u.spentAt,
          amount: u.amount,
          direction: u.direction,
        }))

    for (const [otherId, list] of byOther) {
      const info = nameOf(otherId)
      const activeUnits = list.filter((u) => !u.settled)
      const settledUnits = list.filter((u) => u.settled)

      // 未结清部分：两两净额
      if (activeUnits.length > 0) {
        const theyOwe = activeUnits
          .filter((u) => u.direction === 'they_owe')
          .reduce((s, u) => s + u.amount, 0)
        const iOwe = activeUnits
          .filter((u) => u.direction === 'i_owe')
          .reduce((s, u) => s + u.amount, 0)
        const net = theyOwe - iOwe
        const entry = {
          otherUserId: otherId,
          nickname: info.nickname,
          avatar: info.avatar,
          netAmount: Math.abs(net),
          details: buildDetails(activeUnits),
        }
        if (net > 0) receivables.push(entry)
        else if (net < 0) payables.push(entry)
      }

      // 已结清部分：净额 + 明细（供撤回）
      if (settledUnits.length > 0) {
        const theyOwe = settledUnits
          .filter((u) => u.direction === 'they_owe')
          .reduce((s, u) => s + u.amount, 0)
        const iOwe = settledUnits
          .filter((u) => u.direction === 'i_owe')
          .reduce((s, u) => s + u.amount, 0)
        const net = theyOwe - iOwe
        settledList.push({
          otherUserId: otherId,
          nickname: info.nickname,
          avatar: info.avatar,
          netAmount: Math.abs(net),
          direction: net >= 0 ? 'they_owe' : 'i_owe', // they_owe=对方付我
          details: buildDetails(settledUnits),
        })
      }
    }

    const me = nameOf(userId)
    return {
      me: { userId, ...me },
      receivables,
      payables,
      settledList,
      roundId: roundId || null,
    }
  }

  /**
   * 按人结算：把「我」与 otherUserId 之间两个方向所有活债务单元一次性结清。
   * 结清后若某账单所有非付款人份额都已清 → 置 personSettledAt。
   */
  async settlePerson(
    bookId: string,
    userId: string,
    otherUserId: string,
    roundId?: string,
  ) {
    await this.bookService.assertMember(bookId, userId)
    if (!otherUserId || otherUserId === userId) {
      throw new BadRequestException('结算对象无效')
    }
    await this.bookService.assertMember(bookId, otherUserId)

    // 账单范围：轮次模式取该轮账单，全部模式取未入轮次账单
    const txWhere: any = { bookId, type: 'shared' }
    if (roundId) {
      txWhere.settledRoundId = roundId
    } else {
      txWhere.settledRoundId = IsNull()
      txWhere.personSettledAt = IsNull()
    }
    const txs = await this.txRepo.find({ where: txWhere })

    const shareWhere: any = { bookId }
    shareWhere.roundId = roundId ? roundId : IsNull()
    const existing = await this.shareRepo.find({ where: shareWhere })
    const settledSet = new Set(
      existing.map((s) => `${s.transactionId}::${s.debtorUserId}`),
    )

    // 收集我与 otherUserId 之间待结清的份额单元
    const toCreate: Array<Partial<TxShareSettlement>> = []
    const affectedTxIds = new Set<string>()
    for (const t of txs) {
      const splits = t.splits || []
      // 方向1：我垫付，otherUserId 欠我
      if (t.payerId === userId) {
        const s = splits.find((x) => x.userId === otherUserId)
        if (s && s.amount > 0 && !settledSet.has(`${t.id}::${otherUserId}`)) {
          toCreate.push({
            bookId,
            transactionId: t.id,
            debtorUserId: otherUserId,
            creditorUserId: userId,
            amount: s.amount,
            settledBy: userId,
            roundId: roundId || null,
          })
          affectedTxIds.add(t.id)
        }
      }
      // 方向2：otherUserId 垫付，我欠 otherUserId
      if (t.payerId === otherUserId) {
        const s = splits.find((x) => x.userId === userId)
        if (s && s.amount > 0 && !settledSet.has(`${t.id}::${userId}`)) {
          toCreate.push({
            bookId,
            transactionId: t.id,
            debtorUserId: userId,
            creditorUserId: otherUserId,
            amount: s.amount,
            settledBy: userId,
            roundId: roundId || null,
          })
          affectedTxIds.add(t.id)
        }
      }
    }

    if (toCreate.length === 0) {
      throw new BadRequestException('你与该成员之间没有可结算的账单')
    }

    const queryRunner = this.dataSource.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()

      const created = await queryRunner.manager.save(
        toCreate.map((c) => queryRunner.manager.create(TxShareSettlement, c)),
      )

      // 全部账单模式：某账单所有非付款人份额都结清 → 置 personSettledAt
      // 轮次模式：账单已被 settledRoundId 锁定，无需该标记
      if (!roundId) {
        const now = new Date()
        const affected = txs.filter((t) => affectedTxIds.has(t.id))
        const allShares = existing.concat(
          toCreate.map((c) => ({
            transactionId: c.transactionId,
            debtorUserId: c.debtorUserId,
          })) as any,
        )
        const settledNow = new Set(
          allShares.map((s: any) => `${s.transactionId}::${s.debtorUserId}`),
        )
        for (const t of affected) {
          const debtors = (t.splits || [])
            .filter((s) => s.userId !== t.payerId && s.amount > 0)
            .map((s) => s.userId)
          const allCleared = debtors.every((d) =>
            settledNow.has(`${t.id}::${d}`),
          )
          if (allCleared) {
            await queryRunner.manager.update(Transaction, { id: t.id }, {
              personSettledAt: now,
            })
          }
        }
      }

      await queryRunner.commitTransaction()
      return { settled: true, count: toCreate.length }
    } catch (e) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction()
      // 捕获唯一约束冲突（重复结算）
      if ((e as any).code === '23505' && (e as any).constraint === 'UQ_146b812db2977142f3af001eeb5') {
        throw new BadRequestException('该结算记录已存在，请勿重复操作')
      }
      throw e
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release()
    }
  }

  /**
   * 撤回按人结算：删除「我」与 otherUserId 在该范围（轮次/全部）的份额结清记录，
   * 恢复为待结算。同时清除相关账单可能已置的 personSettledAt。
   */
  async revertPerson(
    bookId: string,
    userId: string,
    otherUserId: string,
    roundId?: string,
  ) {
    await this.bookService.assertMember(bookId, userId)
    if (!otherUserId || otherUserId === userId) {
      throw new BadRequestException('撤回对象无效')
    }

    const shareWhere: any = { bookId }
    shareWhere.roundId = roundId ? roundId : IsNull()
    const existing = await this.shareRepo.find({ where: shareWhere })
    // 与我和对方相关的份额（欠款/收款任一方是我，另一方是对方）
    const mine = existing.filter(
      (s) =>
        (s.debtorUserId === userId && s.creditorUserId === otherUserId) ||
        (s.debtorUserId === otherUserId && s.creditorUserId === userId),
    )
    if (mine.length === 0) {
      throw new BadRequestException('没有可撤回的结算记录')
    }

    const queryRunner = this.dataSource.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()
      await queryRunner.manager.delete(TxShareSettlement, {
        id: In(mine.map((s) => s.id)),
      })
      // 全部账单模式：撤回后相关账单不再整笔结清，清除 personSettledAt
      if (!roundId) {
        const txIds = [...new Set(mine.map((s) => s.transactionId))]
        if (txIds.length) {
          await queryRunner.manager.update(
            Transaction,
            { id: In(txIds) },
            { personSettledAt: null },
          )
        }
      }
      await queryRunner.commitTransaction()
      return { reverted: true, count: mine.length }
    } catch (e) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction()
      throw e
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release()
    }
  }

  /**
   * 计算账本的当前结算方案（实时计算，不持久化）
   * 返回：每人净收支 + 最优转账方案
   */
  async calculate(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)

    // 仅取「未结算」的共享账单（已结算账单归属某轮，不再进入待结算计算）
    const txs = await this.txRepo.find({
      where: { bookId, type: 'shared', settledRoundId: IsNull() },
    })

    const plan = this.computePlanForTxs(txs)

    return {
      balances: plan.balances,
      // 兼容旧前端字段：未结算范围下二者相同
      rawBalances: plan.balances,
      transferPlans: plan.transferPlans,
      txCount: plan.txCount,
      totalAmount: plan.totalAmount,
    }
  }

  /**
   * 纯计算：给定一组账单，算每人净收支 + 最优转账方案 + 快照
   */
  private computePlanForTxs(txs: Transaction[]) {
    const balances = calculateBalances(
      txs.map((t) => ({ payerId: t.payerId, splits: t.splits || [] })),
    )
    const transferPlans = calculateOptimalSettlement(balances)
    const totalAmount = txs.reduce((sum, t) => sum + (t.amount || 0), 0)
    return { balances, transferPlans, txCount: txs.length, totalAmount }
  }

  /**
   * 部分结算预览：只对勾选的未结算账单算方案
   */
  async previewPartial(bookId: string, userId: string, txIds: string[]) {
    await this.bookService.assertMember(bookId, userId)
    if (!txIds || txIds.length === 0) {
      throw new BadRequestException('请选择要结算的账单')
    }
    const txs = await this.txRepo.find({
      where: {
        id: In(txIds),
        bookId,
        type: 'shared',
        settledRoundId: IsNull(),
      },
    })
    if (txs.length !== txIds.length) {
      throw new BadRequestException('部分账单已被结算或不存在，请刷新后重试')
    }
    const plan = this.computePlanForTxs(txs)
    return { balances: plan.balances, transferPlans: plan.transferPlans, txCount: plan.txCount, totalAmount: plan.totalAmount }
  }

  /**
   * 执行结算（全部/部分）：事务内锁定账单 + 生成轮次 + 生成已完成结算记录
   */
  /**
   * 创建结算轮次（全部/部分）。统一为「轮次容器」：只锁定账单进轮次，
   * 不再生成最优路径转账记录；轮次内按人两两净额结算（settlePerson 带 roundId）。
   * - all：锁定「与我相关的未入轮次账单」（我是付款人或参与人）
   * - partial：锁定 dto.txIds（须未入轮次）
   * 允许多个轮次并存（账单靠 settledRoundId 唯一归属，天然隔离）。
   */
  async settle(userId: string, dto: SettleDto) {
    await this.bookService.assertMember(dto.bookId, userId)

    // 单人账本无需结算（结算是多人间债务平账）
    const memberCount = await this.memberRepo.count({ where: { bookId: dto.bookId } })
    if (memberCount <= 1) {
      throw new BadRequestException('单人账本无需结算')
    }

    if (dto.type === 'partial' && (!dto.txIds || dto.txIds.length === 0)) {
      throw new BadRequestException('请选择要结算的账单')
    }

    const queryRunner = this.dataSource.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()

      // 1. 悲观写锁读取候选账单（未入轮次的公账）
      //    同时排除已在「全部账单模式」下按人结清的账单（personSettledAt 有值），
      //    与 byPerson 全部模式的过滤保持对称，避免账单同时归属两种结算模式导致数据割裂。
      const qb = queryRunner.manager
        .createQueryBuilder(Transaction, 't')
        .setLock('pessimistic_write')
        .where('t.bookId = :bookId', { bookId: dto.bookId })
        .andWhere("t.type = 'shared'")
        .andWhere('t.settledRoundId IS NULL')
        .andWhere('t.personSettledAt IS NULL')
      if (dto.type === 'partial') {
        qb.andWhere('t.id IN (:...ids)', { ids: dto.txIds })
      }
      let txs = await qb.getMany()

      if (dto.type === 'partial' && txs.length !== dto.txIds!.length) {
        throw new BadRequestException('部分账单已被结算或不存在，请刷新后重试')
      }

      // 全部结算：仅锁定「与我相关」的账单（我付款 或 我在 splits 里）
      if (dto.type === 'all') {
        txs = txs.filter(
          (t) =>
            t.payerId === userId ||
            (t.splits || []).some((s) => s.userId === userId),
        )
      }
      if (txs.length === 0) {
        throw new BadRequestException('没有可结算的账单')
      }

      const txIds = txs.map((t) => t.id)
      const totalAmount = txs.reduce((sum, t) => sum + (t.amount || 0), 0)

      // 2. 建轮次（transferPlans 存按人净额快照，供列表概览；不走最优路径）
      const round = await queryRunner.manager.save(
        queryRunner.manager.create(SettlementRound, {
          bookId: dto.bookId,
          createdBy: userId,
          type: dto.type,
          txCount: txs.length,
          totalAmount,
          transferPlans: null,
        }),
      )

      // 3. 条件更新：只锁定仍未入轮次的账单，校验影响行数防并发
      const updateRes = await queryRunner.manager.update(
        Transaction,
        { id: In(txIds), settledRoundId: IsNull() },
        { settledRoundId: round.id },
      )
      if (updateRes.affected !== txIds.length) {
        throw new BadRequestException('部分账单已被结算，请刷新后重试')
      }

      await queryRunner.commitTransaction()

      // 返回轮次详情
      const roundWithDetails = await this.roundRepo.findOne({
        where: { id: round.id },
      })

      return { round: roundWithDetails }
    } catch (e) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      throw e
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release()
    }
  }

  /**
   * 撤销某一轮结算：清空账单标记 + 删除本轮结算记录 + 删除轮次
   */
  async revertRound(roundId: string, userId: string) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } })
    if (!round) throw new NotFoundException('结算轮次不存在')
    await this.bookService.assertMember(round.bookId, userId)

    const queryRunner = this.dataSource.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()
      // 释放账单：清空归属
      await queryRunner.manager.update(
        Transaction,
        { settledRoundId: roundId },
        { settledRoundId: null },
      )
      // 删除本轮的份额结清记录 + 旧的最优路径转账记录（兼容历史数据）
      await queryRunner.manager.delete(TxShareSettlement, { roundId })
      await queryRunner.manager.delete(Settlement, { roundId })
      await queryRunner.manager.delete(SettlementRound, { id: roundId })
      await queryRunner.commitTransaction()
      return { reverted: true }
    } catch (e) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      throw e
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release()
    }
  }

  /**
   * 计算一批轮次的完成状态：轮次内所有账单的所有债务份额都已结清 → completed。
   * 返回 Map<roundId, 'active' | 'completed'>。
   */
  private async computeRoundStatuses(rounds: SettlementRound[]) {
    const status = new Map<string, 'active' | 'completed'>()
    if (rounds.length === 0) return status
    const roundIds = rounds.map((r) => r.id)
    const txs = await this.txRepo.find({
      where: { settledRoundId: In(roundIds) },
    })
    const shares = await this.shareRepo.find({
      where: { roundId: In(roundIds) },
    })
    const settledSet = new Set(
      shares.map((s) => `${s.transactionId}::${s.debtorUserId}`),
    )
    // 每轮：收集其所有债务份额（非付款人且金额>0），判断是否全在 settledSet
    for (const r of rounds) {
      const roundTxs = txs.filter((t) => t.settledRoundId === r.id)
      let allCleared = true
      for (const t of roundTxs) {
        const debtors = (t.splits || []).filter(
          (s) => s.userId !== t.payerId && s.amount > 0,
        )
        for (const d of debtors) {
          if (!settledSet.has(`${t.id}::${d.userId}`)) {
            allCleared = false
            break
          }
        }
        if (!allCleared) break
      }
      status.set(r.id, allCleared ? 'completed' : 'active')
    }
    return status
  }

  /**
   * 结算轮次列表：每轮附带状态（进行中/已完成）+ 概览。
   */
  async listRounds(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const rounds = await this.roundRepo.find({
      where: { bookId },
      order: { createdAt: 'DESC' },
    })
    if (rounds.length === 0) return []
    const statusMap = await this.computeRoundStatuses(rounds)
    return rounds.map((r) => ({
      ...r,
      status: statusMap.get(r.id) || 'active',
    }))
  }

  /**
   * 取账本所有「进行中」轮次（供部分结算前弹窗）。
   */
  async getActiveRounds(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const rounds = await this.roundRepo.find({
      where: { bookId },
      order: { createdAt: 'DESC' },
    })
    if (rounds.length === 0) return []
    const statusMap = await this.computeRoundStatuses(rounds)
    return rounds
      .filter((r) => statusMap.get(r.id) === 'active')
      .map((r) => ({ ...r, status: 'active' as const }))
  }

  /**
   * 查找账本"进行中"的轮次（存在待确认 pending 转账）。无则返回 null。
   */
  private async findActiveRound(bookId: string): Promise<SettlementRound | null> {
    const rounds = await this.roundRepo.find({ where: { bookId } })
    if (rounds.length === 0) return null
    const pendings = await this.settlementRepo.find({
      where: { roundId: In(rounds.map((r) => r.id)), status: 'pending' },
    })
    if (pendings.length === 0) return null
    const activeId = pendings[0].roundId
    return rounds.find((r) => r.id === activeId) || null
  }

  /**
   * 取账本进行中轮次及其转账明细（供前端"进行态"展示）。无则返回 null。
   */
  async getActiveRound(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const round = await this.findActiveRound(bookId)
    if (!round) return null
    const settlements = await this.settlementRepo.find({
      where: { roundId: round.id },
      order: { createdAt: 'ASC' },
    })
    return { ...round, settlements }
  }

  /**
   * 确认单笔转账收款（仅付款方或收款方可操作）。
   * 若该确认后本轮已无 pending，轮次自动视为完成（由前端据 settlements 判断）。
   */
  async confirmTransfer(settlementId: string, userId: string) {
    const s = await this.settlementRepo.findOne({ where: { id: settlementId } })
    if (!s) throw new NotFoundException('转账记录不存在')
    if (s.roundId == null) {
      throw new BadRequestException('该记录不属于结算轮次')
    }
    await this.bookService.assertMember(s.bookId, userId)
    if (s.fromUserId !== userId && s.toUserId !== userId) {
      throw new ForbiddenException('只能确认与自己相关的转账')
    }
    if (s.status === 'completed') return s // 幂等
    s.status = 'completed'
    s.completedAt = new Date()
    await this.settlementRepo.save(s)
    return s
  }

  /**
   * 一键确认本轮中与当前用户相关的所有待确认转账
   */
  async confirmMyTransfers(roundId: string, userId: string) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } })
    if (!round) throw new NotFoundException('结算轮次不存在')
    await this.bookService.assertMember(round.bookId, userId)

    const mine = await this.settlementRepo.find({
      where: { roundId, status: 'pending' },
    })
    const toConfirm = mine.filter(
      (s) => s.fromUserId === userId || s.toUserId === userId,
    )
    if (toConfirm.length === 0) return { count: 0 }
    const now = new Date()
    toConfirm.forEach((s) => {
      s.status = 'completed'
      s.completedAt = now
    })
    await this.settlementRepo.save(toConfirm)
    return { count: toConfirm.length }
  }

  /**
   * 撤销单笔已确认转账（恢复 pending，仅付款方或收款方可操作）
   */
  async revertTransfer(settlementId: string, userId: string) {
    const s = await this.settlementRepo.findOne({ where: { id: settlementId } })
    if (!s) throw new NotFoundException('转账记录不存在')
    if (s.roundId == null) {
      throw new BadRequestException('该记录不属于结算轮次')
    }
    await this.bookService.assertMember(s.bookId, userId)
    if (s.fromUserId !== userId && s.toUserId !== userId) {
      throw new ForbiddenException('只能撤销与自己相关的转账')
    }
    if (s.status !== 'completed') return s // 幂等
    s.status = 'pending'
    s.completedAt = null
    await this.settlementRepo.save(s)
    return s
  }

  /**
   * 创建结算记录（仅允许创建自己参与的结算）
   */
  async create(userId: string, dto: CreateSettlementDto) {
    await this.bookService.assertMember(dto.bookId, userId)

    // 权限控制：只能创建自己参与的结算（付款方或收款方）
    if (dto.fromUserId !== userId && dto.toUserId !== userId) {
      throw new ForbiddenException('只能创建自己参与的结算记录')
    }

    // 校验：不能给自己转账
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('不能给自己转账')
    }

    // 校验：双方都是账本成员
    await this.bookService.assertMember(dto.bookId, dto.fromUserId)
    await this.bookService.assertMember(dto.bookId, dto.toUserId)

    const settlement = this.settlementRepo.create({
      bookId: dto.bookId,
      fromUserId: dto.fromUserId,
      toUserId: dto.toUserId,
      amount: dto.amount,
      status: 'pending',
      completedAt: null,
    })

    await this.settlementRepo.save(settlement)
    return settlement
  }

  /**
   * 标记结算完成（仅付款方或收款方可标记）
   */
  async complete(settlementId: string, userId: string) {
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId },
    })
    if (!settlement) throw new NotFoundException('结算记录不存在')

    await this.bookService.assertMember(settlement.bookId, userId)

    // 仅付款方或收款方可标记
    if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
      throw new ForbiddenException('只有付款方或收款方可以标记结算完成')
    }

    if (settlement.status === 'completed') {
      throw new BadRequestException('该结算已完成')
    }

    settlement.status = 'completed'
    settlement.completedAt = new Date()
    await this.settlementRepo.save(settlement)

    return settlement
  }

  /**
   * 查询账本的结算记录列表
   */
  async list(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)

    const settlements = await this.settlementRepo.find({
      where: { bookId },
      order: { createdAt: 'DESC' },
    })

    return settlements
  }

  /**
   * 撤回已完成的结算（平账反悔）：把 completed 记录删除，使其重新计入待结算余额
   * 支持撤回单条；批量撤回由 controller 循环调用或走 revertByUser
   */
  async revert(settlementId: string, userId: string) {
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId },
    })
    if (!settlement) throw new NotFoundException('结算记录不存在')

    await this.bookService.assertMember(settlement.bookId, userId)

    if (settlement.status !== 'completed') {
      throw new BadRequestException('只有已完成的结算才能撤回')
    }
    // 轮次结算不能走遗留单条撤回，必须用 revertRound（否则会留下孤儿账单标记）
    if (settlement.roundId != null) {
      throw new BadRequestException('该结算属于某次结算轮次，请在结算记录中撤销整轮')
    }

    // 撤回即删除该已完成记录，balance 自然恢复（calculate 只按 completed 记录调整余额）
    await this.settlementRepo.delete({ id: settlementId })
    return { reverted: true }
  }

  /**
   * 按用户撤回：撤回某账本中与该用户相关的全部已完成结算
   * targetUserId 为空时撤回该账本所有已完成结算（撤回所有人）
   */
  async revertByUser(bookId: string, userId: string, targetUserId?: string) {
    await this.bookService.assertMember(bookId, userId)

    // 只处理遗留的非轮次结算（roundId 为空）；轮次结算须走 revertRound
    const completed = await this.settlementRepo.find({
      where: { bookId, status: 'completed', roundId: IsNull() },
    })
    if (completed.length === 0) {
      throw new BadRequestException('没有可撤回的已完成结算')
    }

    const toRevert = targetUserId
      ? completed.filter(
          (s) => s.fromUserId === targetUserId || s.toUserId === targetUserId,
        )
      : completed

    if (toRevert.length === 0) {
      throw new BadRequestException('该成员没有可撤回的已完成结算')
    }

    await this.settlementRepo.delete(toRevert.map((s) => s.id))
    return { reverted: true, count: toRevert.length }
  }

  /**
   * 删除结算记录（仅待结算状态可删除）
   */
  async remove(settlementId: string, userId: string) {
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId },
    })
    if (!settlement) throw new NotFoundException('结算记录不存在')

    await this.bookService.assertMember(settlement.bookId, userId)

    // 仅待结算状态可删除
    if (settlement.status === 'completed') {
      throw new BadRequestException('已完成的结算记录不可删除')
    }

    await this.settlementRepo.delete({ id: settlementId })
    return { deleted: true }
  }

  /**
   * 批量创建并完成结算记录（使用事务确保原子性）
   */
  async batchCreateAndComplete(userId: string, dto: BatchCreateSettlementDto) {
    await this.bookService.assertMember(dto.bookId, userId)

    if (!dto.settlements || dto.settlements.length === 0) {
      throw new BadRequestException('结算列表不能为空')
    }

    // 校验：所有结算必须包含当前用户（付款方或收款方）
    const allInvolvingUser = dto.settlements.every(
      (s) => s.fromUserId === userId || s.toUserId === userId,
    )
    if (!allInvolvingUser) {
      throw new ForbiddenException('只能创建自己参与的结算记录')
    }

    // 校验：所有参与人都是账本成员
    const allUserIds = new Set<string>()
    dto.settlements.forEach((s) => {
      if (s.fromUserId === s.toUserId) {
        throw new BadRequestException('不能给自己转账')
      }
      allUserIds.add(s.fromUserId)
      allUserIds.add(s.toUserId)
    })

    for (const uid of allUserIds) {
      await this.bookService.assertMember(dto.bookId, uid)
    }

    // 使用事务批量创建并完成
    const queryRunner = this.dataSource.createQueryRunner()
    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()
      const createdSettlements: Settlement[] = []

      for (const item of dto.settlements) {
        const settlement = this.settlementRepo.create({
          bookId: dto.bookId,
          fromUserId: item.fromUserId,
          toUserId: item.toUserId,
          amount: item.amount,
          status: 'completed', // 直接标记为已完成
          completedAt: new Date(),
        })
        const saved = await queryRunner.manager.save(settlement)
        createdSettlements.push(saved)
      }

      await queryRunner.commitTransaction()
      return { count: createdSettlements.length, settlements: createdSettlements }
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      throw error
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release()
    }
  }
}
