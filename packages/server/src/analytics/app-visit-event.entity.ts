import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm'

/** 小程序前台进入事件。visitorId 是匿名安装标识，不保存 IP 或设备指纹。 */
@Entity('app_visit_events')
@Index('IDX_app_visit_events_created_at', ['createdAt'])
@Index('IDX_app_visit_events_visitor_created_at', ['visitorId', 'createdAt'])
@Index('IDX_app_visit_events_user_created_at', ['userId', 'createdAt'])
export class AppVisitEvent {
  /** 客户端为每次 onShow 生成 UUID，作为重试时的幂等键。 */
  @PrimaryColumn({ type: 'uuid' })
  id: string

  @Column({ name: 'visitor_id', type: 'varchar', length: 64 })
  visitorId: string

  /** 仅在服务端成功验证 JWT 后写入，客户端不能指定。 */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
