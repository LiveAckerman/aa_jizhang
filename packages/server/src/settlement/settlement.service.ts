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
import { Transaction } from '../transaction/transaction.entity'
import { BookService } from '../book/book.service'
import { CreateSettlementDto } from './dto/create-settlement.dto'
import { BatchCreateSettlementDto } from './dto/batch-create-settlement.dto'
import { SettleDto } from './dto/settle.dto'
import {
  calculateBalances,
  calculateOptimalSettlement,
  TransferPlan,
  UserBalance,
} from './settlement.algorithm'

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SettlementRound)
    private readonly roundRepo: Repository<SettlementRound>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly bookService: BookService,
    private readonly dataSource: DataSource,
  ) {}

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
  async settle(userId: string, dto: SettleDto) {
    await this.bookService.assertMember(dto.bookId, userId)

    // 1. 确定本轮账单集合
    const where: any = {
      bookId: dto.bookId,
      type: 'shared',
      settledRoundId: IsNull(),
    }
    if (dto.type === 'partial') {
      if (!dto.txIds || dto.txIds.length === 0) {
        throw new BadRequestException('请选择要结算的账单')
      }
      where.id = In(dto.txIds)
    }
    const txs = await this.txRepo.find({ where })

    if (dto.type === 'partial' && txs.length !== dto.txIds!.length) {
      throw new BadRequestException('部分账单已被结算或不存在，请刷新后重试')
    }
    if (txs.length === 0) {
      throw new BadRequestException('没有可结算的账单')
    }

    // 2. 计算方案
    const plan = this.computePlanForTxs(txs)
    const txIds = txs.map((t) => t.id)

    // 3. 事务：建轮次 + 标记账单 + 生成已完成结算
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
      const round = await queryRunner.manager.save(
        queryRunner.manager.create(SettlementRound, {
          bookId: dto.bookId,
          createdBy: userId,
          type: dto.type,
          txCount: plan.txCount,
          totalAmount: plan.totalAmount,
          transferPlans: plan.transferPlans,
        }),
      )

      await queryRunner.manager.update(
        Transaction,
        { id: In(txIds) },
        { settledRoundId: round.id },
      )

      const settlements = plan.transferPlans.map((p) =>
        queryRunner.manager.create(Settlement, {
          bookId: dto.bookId,
          fromUserId: p.fromUserId,
          toUserId: p.toUserId,
          amount: p.amount,
          status: 'completed' as const,
          roundId: round.id,
          completedAt: new Date(),
        }),
      )
      if (settlements.length) await queryRunner.manager.save(settlements)

      await queryRunner.commitTransaction()
      return { round, settlements }
    } catch (e) {
      await queryRunner.rollbackTransaction()
      throw e
    } finally {
      await queryRunner.release()
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
    await queryRunner.connect()
    await queryRunner.startTransaction()
    try {
      await queryRunner.manager.update(
        Transaction,
        { settledRoundId: roundId },
        { settledRoundId: null },
      )
      await queryRunner.manager.delete(Settlement, { roundId })
      await queryRunner.manager.delete(SettlementRound, { id: roundId })
      await queryRunner.commitTransaction()
      return { reverted: true }
    } catch (e) {
      await queryRunner.rollbackTransaction()
      throw e
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 结算轮次列表：每轮附带其转账明细（含昵称由前端 memberMap 补全）
   */
  async listRounds(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)
    const rounds = await this.roundRepo.find({
      where: { bookId },
      order: { createdAt: 'DESC' },
    })
    if (rounds.length === 0) return []
    const settlements = await this.settlementRepo.find({
      where: { roundId: In(rounds.map((r) => r.id)) },
    })
    return rounds.map((r) => ({
      ...r,
      settlements: settlements.filter((s) => s.roundId === r.id),
    }))
  }

  /**
   * 调整余额：减去已完成的结算金额
   */
  private adjustBalancesWithSettlements(
    balances: UserBalance[],
    settlements: Settlement[],
  ): UserBalance[] {
    const balanceMap = new Map<string, number>()
    balances.forEach((b) => balanceMap.set(b.userId, b.balance))

    for (const s of settlements) {
      // 付款方：应付减少（余额增加）
      const fromBalance = balanceMap.get(s.fromUserId) || 0
      balanceMap.set(s.fromUserId, fromBalance + s.amount)

      // 收款方：应收减少（余额减少）
      const toBalance = balanceMap.get(s.toUserId) || 0
      balanceMap.set(s.toUserId, toBalance - s.amount)
    }

    return Array.from(balanceMap.entries()).map(([userId, balance]) => ({
      userId,
      balance,
    }))
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

    const completed = await this.settlementRepo.find({
      where: { bookId, status: 'completed' },
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
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
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
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }
}
