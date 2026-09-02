import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/** 分享令牌配置 */
export interface ShareTokenConfig {
  groupBy: 'person' | 'category' | 'paymentMethod'
  includeUnsettled: boolean
}

/**
 * 分享令牌：用于免登录访问账本总结
 * 有效期 7 天，过期后自动失效
 */
@Entity('share_tokens')
export class ShareToken {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ length: 36 })
  bookId: string

  @Column({ type: 'jsonb' })
  config: ShareTokenConfig

  @CreateDateColumn()
  createdAt: Date

  @Column({ type: 'timestamp' })
  expiresAt: Date
}
