import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 将所有时间字段从 timestamp 改为 timestamptz（带时区）。
 * UTC 会话下执行时保持时间点不变，消除读取时的时区解释歧义。
 */
export class ConvertTimestampToTimestamptz1725249600000 implements MigrationInterface {
  name = 'ConvertTimestampToTimestamptz1725249600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users 表
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'
    `)

    // books 表
    await queryRunner.query(`
      ALTER TABLE "books"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "books"
      ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'
    `)

    // book_groups 表
    await queryRunner.query(`
      ALTER TABLE "book_groups"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "book_groups"
      ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'
    `)

    // book_members 表
    await queryRunner.query(`
      ALTER TABLE "book_members"
      ALTER COLUMN "joinedAt" TYPE timestamptz USING "joinedAt" AT TIME ZONE 'UTC'
    `)

    // transactions 表
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'
    `)

    // transaction_logs 表
    await queryRunner.query(`
      ALTER TABLE "transaction_logs"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)

    // settlements 表
    await queryRunner.query(`
      ALTER TABLE "settlements"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)

    // settlement_rounds 表
    await queryRunner.query(`
      ALTER TABLE "settlement_rounds"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)

    // tx_share_settlements 表
    await queryRunner.query(`
      ALTER TABLE "tx_share_settlements"
      ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：改回 timestamp without time zone
    // 注意：回滚会丢失时区信息，但保留 UTC 时间值本身

    await queryRunner.query(`
      ALTER TABLE "tx_share_settlements"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "settlement_rounds"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "settlements"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "transaction_logs"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ALTER COLUMN "updatedAt" TYPE timestamp USING "updatedAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "book_members"
      ALTER COLUMN "joinedAt" TYPE timestamp USING "joinedAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "book_groups"
      ALTER COLUMN "updatedAt" TYPE timestamp USING "updatedAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "book_groups"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "books"
      ALTER COLUMN "updatedAt" TYPE timestamp USING "updatedAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "books"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "updatedAt" TYPE timestamp USING "updatedAt" AT TIME ZONE 'UTC'
    `)
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE 'UTC'
    `)
  }
}
