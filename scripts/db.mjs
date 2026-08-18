// 测试脚本共享的 Postgres 连接助手
// 提供 execute(sql, params)：把 MySQL 风格的 `?` 占位符转成 Postgres 的 $1,$2...
// 返回 [rows] 以兼容原 mysql2 的 [rows] 解构写法。
import { readFileSync } from 'fs'

const ROOT = '/Users/lijiwang/Documents/test/aa_jizhang'

export function loadEnv() {
  return Object.fromEntries(
    readFileSync(ROOT + '/.env', 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
}

export async function connect(env) {
  const pg = (await import(ROOT + '/node_modules/.pnpm/pg@8.23.0/node_modules/pg/lib/index.js')).default
  const client = new pg.Client({
    host: env.DB_HOST,
    port: +env.DB_PORT,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    connectionTimeoutMillis: 8000,
  })
  await client.connect()
  return {
    // 兼容 mysql2 的 conn.execute(sql, params) → 返回 [rows]
    async execute(sql, params = []) {
      let i = 0
      const pgSql = sql.replace(/\?/g, () => '$' + ++i)
      const r = await client.query(pgSql, params)
      return [r.rows]
    },
    async end() {
      await client.end()
    },
  }
}
