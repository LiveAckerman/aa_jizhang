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

  /** 金额（**结算货币 CNY**，单位：分，避免浮点误差） */
  @Column({ type: 'int' })
  amount: number

  /** 原始货币代码，默认 CNY */
  @Column({ length: 8, default: 'CNY' })
  currency: string

  /** 原始货币的金额（分）。currency=CNY 时与 amount 相同；其他币种时为用户实际输入的金额（分） */
  @Column({ type: 'int', nullable: true })
  originalAmount: number | null

  /** 记账时快照的 原始货币兑 CNY 汇率（1 单位原币 = ? CNY），CNY 时为 1 */
  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  exchangeRate: string | null

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
  @Column({ type: 'jsonb', nullable: true })
  splits: SplitDetail[] | null

  /** 所属结算轮次 id：null=未结算；有值=已属于某轮结算（多次结算） */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  settledRoundId: string | null

  /**
   * 按人结算：当所有非付款人份额都已结清时置为该时刻，表示整笔账单结清。
   * 与 settledRoundId 独立（一个走轮次结算，一个走按人结算）。
   */
  @Column({ type: 'timestamptz', nullable: true })
  personSettledAt: Date | null

  /** 图片凭证 URL 列表（JSON） */
  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null

  /** 地点名称（可空） */
  @Column({ type: 'varchar', length: 128, default: '' })
  locationName: string

  /** 详细地址（可空） */
  @Column({ type: 'varchar', length: 255, default: '' })
  locationAddress: string

  /** 纬度（可空） */
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number | null

  /** 经度（可空） */
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number | null

  /** 消费发生时间 */
  @Column({ type: 'timestamptz' })
  spentAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
