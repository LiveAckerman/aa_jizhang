import { Column, Entity, PrimaryColumn } from 'typeorm'

/** 记录功能真正启用的服务端时间，不能由首条事件反推。 */
@Entity('analytics_collection_status')
export class AnalyticsCollectionStatus {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date
}
