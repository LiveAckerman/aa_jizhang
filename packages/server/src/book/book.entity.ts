import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/** 账本场景类型 */
// 预设场景 key；自定义场景时 scene 存 'custom'，自定义名称存于 sceneName
export type BookScene =
  | 'travel'
  | 'dinner'
  | 'rent'
  | 'activity'
  | 'party'
  | 'club'
  | 'family'
  | 'wedding'
  | 'custom'

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 账本名称 */
  @Column({ length: 64 })
  name: string

  /** 场景类型（预设 key 或 'custom'） */
  @Column({ length: 16, default: 'custom' })
  scene: BookScene

  /** 自定义场景名称（scene==='custom' 时使用；预设场景为空） */
  @Column({ length: 32, default: '' })
  sceneName: string

  /** 封面图标标识（存储图标 key，非 emoji） */
  @Column({ length: 128, default: '' })
  icon: string

  /** 封面图片 URL（自定义封面，为空时按 scene 取默认封面） */
  @Column({ type: 'text', nullable: true })
  cover: string

  /** 账本描述 */
  @Column({ length: 255, default: '' })
  description: string

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
