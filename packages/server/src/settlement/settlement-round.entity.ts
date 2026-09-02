import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/** 结算轮次类型：all=全部结算，partial=部分结算 */
export type SettlementRoundType = 'all' | 'partial'

/** 转账方案快照条目 */
export interface RoundTransferPlan {
  fromUserId: string
  toUserId: string
  amount: number
}

/**
 * 结算轮次：一次「全部/部分」结算生成一条，记录本轮覆盖的账单快照与转账方案。
 * 账单通过 Transaction.settledRoundId 归属到某一轮；撤销时删除本轮并清空账单标记。
 */
@Entity('settlement_rounds')
export class SettlementRound {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 所属账本 */
  @Index()
  @Column({ length: 36 })
  bookId: string

  /** 发起人用户 id */
  @Column({ length: 36 })
  createdBy: string

  /** 结算类型 */
  @Column({ length: 16, default: 'all' })
  type: SettlementRoundType

  /** 本轮账单数（快照） */
  @Column({ type: 'int', default: 0 })
  txCount: number

  /** 本轮账单总额（分，快照） */
  @Column({ type: 'int', default: 0 })
  totalAmount: number

  /** 转账方案快照（撤销/展示用） */
  @Column({ type: 'jsonb', nullable: true })
  transferPlans: RoundTransferPlan[] | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
