import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/** 结算状态 */
export type SettlementStatus = 'pending' | 'completed'

@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 所属账本 */
  @Index()
  @Column({ length: 36 })
  bookId: string

  /** 付款方用户 id */
  @Index()
  @Column({ length: 36 })
  fromUserId: string

  /** 收款方用户 id */
  @Index()
  @Column({ length: 36 })
  toUserId: string

  /** 结算金额（分） */
  @Column({ type: 'int' })
  amount: number

  /** 结算状态 */
  @Index()
  @Column({ length: 16, default: 'pending' })
  status: SettlementStatus

  /** 完成时间 */
  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null

  /** 创建时间 */
  @CreateDateColumn()
  createdAt: Date
}
