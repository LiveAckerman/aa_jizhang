import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm'

/**
 * 账单份额级结算记录（按人结算）。
 * 一条 = 某笔公账中「某个欠款人应还给付款人的那一份」已结清。
 * 归属到某个结算轮次（roundId）；全部账单模式（无轮次）下 roundId 为 null。
 */
@Entity('tx_share_settlements')
@Unique(['transactionId', 'debtorUserId'])
export class TxShareSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 所属账本 */
  @Index()
  @Column({ length: 36 })
  bookId: string

  /** 关联账单 */
  @Index()
  @Column({ length: 36 })
  transactionId: string

  /** 欠款方（该份额所属参与人） */
  @Index()
  @Column({ length: 36 })
  debtorUserId: string

  /** 收款方（= 账单付款人，冗余存储便于查询） */
  @Column({ length: 36 })
  creditorUserId: string

  /** 该份额金额（分） */
  @Column({ type: 'int' })
  amount: number

  /** 触发本次结算的用户 */
  @Column({ length: 36 })
  settledBy: string

  /** 所属结算轮次（份额结清归属的轮次；全部账单模式为 null） */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  roundId: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
