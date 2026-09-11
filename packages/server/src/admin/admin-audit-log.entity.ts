import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

/**
 * AdminJS 业务写操作审计。
 *
 * 这里不保存管理员密码或内部令牌，只记录操作者标识、资源、动作和
 * 经过白名单筛选后的请求参数，便于事后定位后台改动。
 */
@Entity('admin_audit_logs')
@Index('IDX_admin_audit_logs_resource_created_at', ['resource', 'createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 128 })
  actor: string

  @Column({ length: 32 })
  action: string

  @Column({ length: 32 })
  resource: string

  @Column({ length: 36 })
  resourceId: string

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
