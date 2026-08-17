import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWechatAuthorizationFields1723881200000 implements MigrationInterface {
  name = 'AddWechatAuthorizationFields1723881200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加微信授权标记字段
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "hasUsedWechatAvatar" boolean NOT NULL DEFAULT false
    `)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "hasUsedWechatNickname" boolean NOT NULL DEFAULT false
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：删除字段
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "hasUsedWechatNickname"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "hasUsedWechatAvatar"`)
  }
}
