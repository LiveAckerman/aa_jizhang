import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * 账本分组（用户维度）
 * 每个用户各自组织自己看到的账本；分组不跨用户共享。
 */
@Entity('book_groups')
export class BookGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 所属用户 */
  @Index()
  @Column({ length: 36 })
  userId: string

  /** 分组名称 */
  @Column({ length: 32 })
  name: string

  /** 是否是「默认分组」（每人一个，不可删除） */
  @Column({ default: false })
  isDefault: boolean

  /** 排序（越小越靠前，默认分组固定 0） */
  @Column({ type: 'int', default: 100 })
  sortOrder: number

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date
}
