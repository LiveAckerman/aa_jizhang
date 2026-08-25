import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import { join } from 'path'

// 加载根目录的 .env
config({ path: join(__dirname, '../../../.env') })

// 环境守卫：与 app.module.ts 一致。只有 NODE_ENV=production 才对生产库跑迁移，
// 其余环境强制指向测试库 aa_jizhang_test，避免本地迁移误改生产库结构。
const isProd = process.env.NODE_ENV === 'production'
const database = isProd
  ? process.env.DB_DATABASE || 'aa_jizhang'
  : 'aa_jizhang_test'

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database,
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false, // migration 模式下必须关闭
})
