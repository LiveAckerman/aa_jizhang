import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm'

/** 成员角色 */
export type MemberRole = 'owner' | 'member'

@Entity('book_members')
@Unique(['bookId', 'userId']) // 同一账本同一用户只能有一条成员记录
export class BookMember {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 账本 id */
  @Index()
  @Column({ length: 36 })
  bookId: string

  /** 用户 id */
  @Index()
  @Column({ length: 36 })
  userId: string

  /** 在该账本中的显示昵称（可与用户全局昵称不同） */
  @Column({ length: 64, default: '' })
  displayName: string

  /** 角色 */
  @Column({ length: 16, default: 'member' })
  role: MemberRole

  /**
   * 该成员把这个账本归入的分组 id（用户维度）。
   * null 或 '' 表示归入用户的默认分组。
   */
  @Index()
  @Column({ length: 36, default: '' })
  groupId: string

  @CreateDateColumn()
  joinedAt: Date
}
