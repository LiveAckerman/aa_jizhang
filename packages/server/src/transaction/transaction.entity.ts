import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/** 账单类型：shared=共享账（所有成员可见），private=私密账（仅自己可见） */
export type TransactionType = 'shared' | 'private'

/** 分账方式 */
export type SplitMethod = 'average' | 'ratio' | 'shares' | 'fixed'

/** 单个参与人的分账明细 */
export interface SplitDetail {
  /** 参与用户 id */
  userId: string
  /** 该用户应承担的金额（分） */
  amount: number
  /** 比例/份额（ratio/shares 方式下使用） */
  weight?: number
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 所属账本 */
  @Index()
  @Column({ length: 36 })
  bookId: string

  /** 账单类型：共享账 / 私密账（核心字段） */
  @Column({ length: 16, default: 'shared' })
  type: TransactionType

  /** 金额（单位：分，避免浮点误差） */
  @Column({ type: 'int' })
  amount: number

  /** 分类（图标 key，如 food/transport/hotel） */
  @Column({ length: 32, default: 'other' })
  category: string

  /** 备注 */
  @Column({ type: 'varchar', length: 255, default: '' })
  note: string

  /** 付款人用户 id */
  @Index()
  @Column({ length: 36 })
  payerId: string

  /** 记录创建者用户 id（私密账隔离依据） */
  @Index()
  @Column({ length: 36 })
  creatorId: string

  /** 分账方式（仅共享账有效） */
  @Column({ length: 16, default: 'average' })
  splitMethod: SplitMethod

  /** 分账明细（JSON，仅共享账有效） */
  @Column({ type: 'json', nullable: true })
  splits: SplitDetail[] | null

  /** 图片凭证 URL 列表（JSON） */
  @Column({ type: 'json', nullable: true })
  images: string[] | null

  /** 消费发生时间 */
  @Column({ type: 'datetime' })
  spentAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
