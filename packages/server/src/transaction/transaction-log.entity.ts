import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/** 单条字段变更明细 */
export interface FieldChange {
  /** 字段 key，如 'amount' */
  field: string
  /** 字段中文标签，如 '支付金额' */
  label: string
  /** 修改前的显示值（已格式化，如 '98.00'） */
  oldValue: string
  /** 修改后的显示值 */
  newValue: string
}

/** 账单操作类型 */
export type LogAction = 'create' | 'update' | 'delete'

@Entity('transaction_logs')
export class TransactionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ length: 36 })
  transactionId: string

  @Index()
  @Column({ length: 36 })
  bookId: string

  /** 操作人 userId */
  @Index()
  @Column({ length: 36 })
  userId: string

  @Column({ length: 16 })
  action: LogAction

  /**
   * 变更明细：
   * - create/delete 时为 null（只记事件本身）
   * - update 时是变更字段数组
   */
  @Column({ type: 'jsonb', nullable: true })
  changes: FieldChange[] | null

  @CreateDateColumn()
  createdAt: Date
}
