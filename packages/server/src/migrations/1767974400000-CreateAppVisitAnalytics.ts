import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreateAppVisitAnalytics1767974400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('app_visit_events'))) {
      await queryRunner.createTable(new Table({
        name: 'app_visit_events',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'visitor_id', type: 'varchar', length: '64' },
          { name: 'user_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }))
    }

    let visitsTable = await queryRunner.getTable('app_visit_events')
    const hasUserForeignKey = visitsTable?.foreignKeys.some((foreignKey) =>
      foreignKey.columnNames.length === 1
      && foreignKey.columnNames[0] === 'user_id'
      && foreignKey.referencedTableName === 'users')
    if (!hasUserForeignKey) {
      await queryRunner.createForeignKey('app_visit_events', new TableForeignKey({
        columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL',
      }))
    }

    visitsTable = await queryRunner.getTable('app_visit_events')
    const expectedIndices = [
      new TableIndex({ name: 'IDX_app_visit_events_created_at', columnNames: ['created_at'] }),
      new TableIndex({ name: 'IDX_app_visit_events_visitor_created_at', columnNames: ['visitor_id', 'created_at'] }),
      new TableIndex({ name: 'IDX_app_visit_events_user_created_at', columnNames: ['user_id', 'created_at'] }),
    ]
    for (const index of expectedIndices) {
      if (!visitsTable?.indices.some((current) => current.name === index.name)) {
        await queryRunner.createIndex('app_visit_events', index)
      }
    }

    if (!(await queryRunner.hasTable('analytics_collection_status'))) {
      await queryRunner.createTable(new Table({
        name: 'analytics_collection_status',
        columns: [
          { name: 'key', type: 'varchar', length: '64', isPrimary: true },
          { name: 'started_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }))
    }
    await queryRunner.query("INSERT INTO analytics_collection_status (key, started_at) VALUES ('app_visits', CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING")
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('analytics_collection_status')) {
      await queryRunner.dropTable('analytics_collection_status')
    }
    if (await queryRunner.hasTable('app_visit_events')) {
      await queryRunner.dropTable('app_visit_events')
    }
  }
}
