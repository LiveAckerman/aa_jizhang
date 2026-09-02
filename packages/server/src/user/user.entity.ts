import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 微信 openid，唯一 */
  @Index({ unique: true })
  @Column({ length: 64 })
  openid: string

  /** 微信 unionid（可选） */
  @Column({ length: 64, nullable: true })
  unionid: string

  /** 昵称 */
  @Column({ length: 64, default: '' })
  nickname: string

  /** 头像 URL */
  @Column({ type: 'text', nullable: true })
  avatar: string

  /** 是否完善了个人信息 */
  @Column({ default: false })
  isProfileComplete: boolean

  /** 是否已弹过头像昵称授权提示（只弹一次，与 isProfileComplete 解耦） */
  @Column({ default: false })
  hasPromptedProfile: boolean

  /** 是否使用过微信授权头像 */
  @Column({ default: false })
  hasUsedWechatAvatar: boolean

  /** 是否使用过微信授权昵称 */
  @Column({ default: false })
  hasUsedWechatNickname: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date
}
