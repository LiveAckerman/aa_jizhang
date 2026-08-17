import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Settlement } from './settlement.entity'
import { Transaction } from '../transaction/transaction.entity'
import { BookService } from '../book/book.service'
import { CreateSettlementDto } from './dto/create-settlement.dto'
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
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly bookService: BookService,
  ) {}

  /**
   * 计算账本的当前结算方案（实时计算，不持久化）
   * 返回：每人净收支 + 最优转账方案
   */
  async calculate(bookId: string, userId: string) {
    await this.bookService.assertMember(bookId, userId)

    // 1. 拉取账本所有共享账单
    const txs = await this.txRepo.find({
      where: { bookId, type: 'shared' },
    })

    // 2. 计算每人净收支
    const balances = calculateBalances(
      txs.map((t) => ({
        payerId: t.payerId,
        splits: t.splits || [],
      })),
    )

    // 3. 排除已完成的结算记录（减去已结算金额）
    const completedSettlements = await this.settlementRepo.find({
      where: { bookId, status: 'completed' },
    })

    const adjustedBalances = this.adjustBalancesWithSettlements(
      balances,
      completedSettlements,
    )

    // 4. 计算最优转账方案
    const transferPlans = calculateOptimalSettlement(adjustedBalances)

    // 5. 查询待结算记录
    const pendingSettlements = await this.settlementRepo.find({
      where: { bookId, status: 'pending' },
      order: { createdAt: 'ASC' },
    })

    return {
      balances: adjustedBalances,
      transferPlans,
      pendingSettlements,
    }
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
   * 创建结算记录
   */
  async create(userId: string, dto: CreateSettlementDto) {
    await this.bookService.assertMember(dto.bookId, userId)

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
}
