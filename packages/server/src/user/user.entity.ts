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

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
