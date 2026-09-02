import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateShareTokensTable1737360000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'share_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'bookId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'config',
            type: 'jsonb',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
          },
        ],
      }),
      true,
    )

    // 为 bookId 创建索引，提高查询性能
    await queryRunner.createIndex(
      'share_tokens',
      new TableIndex({
        name: 'IDX_share_tokens_bookId',
        columnNames: ['bookId'],
      }),
    )

    // 为 expiresAt 创建索引，便于定期清理过期令牌
    await queryRunner.createIndex(
      'share_tokens',
      new TableIndex({
        name: 'IDX_share_tokens_expiresAt',
        columnNames: ['expiresAt'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('share_tokens')
  }
}
