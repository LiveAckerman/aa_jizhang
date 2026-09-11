import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateAdminAuditLogs1768060800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('admin_audit_logs')) return

    await queryRunner.createTable(
      new Table({
        name: 'admin_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'actor', type: 'varchar', length: '128' },
          { name: 'action', type: 'varchar', length: '32' },
          { name: 'resource', type: 'varchar', length: '32' },
          { name: 'resourceId', type: 'varchar', length: '36' },
          { name: 'payload', type: 'jsonb', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'admin_audit_logs',
      new TableIndex({
        name: 'IDX_admin_audit_logs_resource_created_at',
        columnNames: ['resource', 'createdAt'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('admin_audit_logs')) {
      await queryRunner.dropTable('admin_audit_logs')
    }
  }
}
