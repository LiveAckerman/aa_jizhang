import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/** 账本场景类型 */
export type BookScene = 'travel' | 'dinner' | 'rent' | 'activity' | 'custom'

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 账本名称 */
  @Column({ length: 64 })
  name: string

  /** 场景类型 */
  @Column({ length: 16, default: 'custom' })
  scene: BookScene

  /** 封面图标/emoji 标识（存储图标 key，非 emoji） */
  @Column({ length: 128, default: '' })
  icon: string

  /** 创建者用户 id */
  @Index()
  @Column({ length: 36 })
  ownerId: string

  /** 邀请码（用于分享加入） */
  @Index({ unique: true })
  @Column({ length: 16 })
  inviteCode: string

  /** 是否已归档/结算 */
  @Column({ default: false })
  archived: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
