/**
 * 对真实 PostgreSQL 执行统计窗口验收，但所有样本表均为事务内临时表。
 *
 * 运行：pnpm --filter @departure/admin exec tsx src/verify-statistics-boundaries.ts
 */
import assert from 'node:assert/strict'
import knexModule, { type Knex } from 'knex'
import { loadConfig } from './config.js'
import { loadStatistics } from './statistics.js'

const asOf = new Date('2026-09-08T16:00:00.000Z') // 北京时间 2026-09-09 00:00:00
const start30 = '2026-08-11T00:00:00.000+08:00'
const before30 = '2026-08-10T23:59:59.999+08:00'
const start7 = '2026-09-03T00:00:00.000+08:00'
const before7 = '2026-09-02T23:59:59.999+08:00'
const beforeTodayEnd = '2026-09-08T23:59:59.999+08:00'
const atAsOf = '2026-09-09T00:00:00.000+08:00'
const afterAsOf = '2026-09-09T00:00:00.001+08:00'
const collectionStart = '2026-09-05T12:00:00.000+08:00'
// knex 的 CommonJS 导出在 NodeNext 类型解析下不是 callable；运行时默认导出仍是工厂函数。
const knexFactory = knexModule as unknown as (config: Knex.Config) => Knex

const expectedDates = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7, 11 + index))
  return date.toISOString().slice(0, 10)
})

const point = <T extends { date: string; value: number | null; coverage: string }>(
  series: T[],
  date: string,
): T => {
  const result = series.find((item) => item.date === date)
  assert.ok(result, `缺少 ${date} 的统计点`)
  return result
}

const insertCoreRows = async (trx: Knex.Transaction, table: 'users' | 'books') => {
  for (const createdAt of [before30, start30, before7, start7, beforeTodayEnd, atAsOf, afterAsOf]) {
    await trx.raw(`INSERT INTO ${table} ("createdAt") VALUES (?::timestamptz)`, [createdAt])
  }
}

const main = async (): Promise<void> => {
  const config = loadConfig()
  if (config.isProduction || config.databaseName !== 'aa_jizhang_test') {
    throw new Error('边界验收只能连接非 production 的 aa_jizhang_test')
  }

  // 与后台运行时使用同一份 loadConfig() 生成的 PostgreSQL 连接配置。
  const knex = knexFactory({ client: 'pg', connection: config.databaseUrl, pool: { min: 0, max: 1 } })
  try {
    const database = (await knex.raw('SELECT current_database() AS name')) as {
      rows: Array<{ name: string }>
    }
    assert.equal(database.rows[0]?.name, 'aa_jizhang_test')

    // loadStatistics 会显式检查 public 表存在；临时表只遮蔽本事务内的查询，不碰持久数据。
    const persistentTables = (await knex.raw(`
      SELECT to_regclass('public.app_visit_events') IS NOT NULL AS events_exists,
             to_regclass('public.analytics_collection_status') IS NOT NULL AS status_exists
    `)) as { rows: Array<{ events_exists: boolean; status_exists: boolean }> }
    assert.equal(persistentTables.rows[0]?.events_exists, true, '请先在测试库部署访问采集迁移')
    assert.equal(persistentTables.rows[0]?.status_exists, true, '请先在测试库部署访问采集迁移')

    const trx = await knex.transaction()
    try {
      await trx.raw('CREATE TEMP TABLE users ("createdAt" timestamptz NOT NULL) ON COMMIT DROP')
      await trx.raw('CREATE TEMP TABLE books ("createdAt" timestamptz NOT NULL) ON COMMIT DROP')
      await trx.raw('CREATE TEMP TABLE transactions ("createdAt" timestamptz NOT NULL, "spentAt" timestamptz NOT NULL) ON COMMIT DROP')
      await trx.raw('CREATE TEMP TABLE app_visit_events (created_at timestamptz NOT NULL) ON COMMIT DROP')
      await trx.raw('CREATE TEMP TABLE analytics_collection_status (key varchar(64) PRIMARY KEY, started_at timestamptz NOT NULL) ON COMMIT DROP')

      await insertCoreRows(trx, 'users')
      await insertCoreRows(trx, 'books')
      for (const createdAt of [before30, start30, before7, start7, beforeTodayEnd, atAsOf, afterAsOf]) {
        // 全部消费日设在未来，证明“记录账单”按 createdAt，而非 spentAt 统计。
        await trx.raw('INSERT INTO transactions ("createdAt", "spentAt") VALUES (?::timestamptz, ?::timestamptz)', [createdAt, '2030-01-01T00:00:00.000+08:00'])
      }

      const withoutCollection = await loadStatistics(trx, asOf)
      assert.equal(withoutCollection.metrics.visits.totals.days30.value, null)
      assert.equal(withoutCollection.metrics.visits.totals.days30.coverage, 'not_collected')

      await trx.raw('INSERT INTO analytics_collection_status (key, started_at) VALUES (?, ?::timestamptz)', ['app_visits', collectionStart])
      await trx.raw('INSERT INTO app_visit_events (created_at) VALUES (?::timestamptz), (?::timestamptz), (?::timestamptz), (?::timestamptz)', [
        '2026-09-05T11:59:59.999+08:00', // 启用前，排除
        collectionStart, // 启用瞬间，计入
        atAsOf, // asOf 边界，计入
        afterAsOf, // asOf 后，排除
      ])

      const result = await loadStatistics(trx, asOf)
      for (const key of ['registrations', 'books', 'transactions'] as const) {
        assert.equal(result.metrics[key].totals.today.value, 1, `${key} 当天边界`)
        assert.equal(result.metrics[key].totals.days7.value, 3, `${key} 近 7 天边界`)
        assert.equal(result.metrics[key].totals.days30.value, 5, `${key} 近 30 天边界`)
        assert.deepEqual(result.metrics[key].series.map((item) => item.date), expectedDates, `${key} 连续 30 天文本日期`)
      }
      assert.equal(result.metrics.transactions.totals.days30.value, 5, '账单必须按 createdAt 而非 spentAt')

      assert.equal(point(result.metrics.visits.series, '2026-09-04').value, null, '启用日前必须不可用')
      assert.equal(point(result.metrics.visits.series, '2026-09-04').coverage, 'not_collected')
      assert.equal(point(result.metrics.visits.series, '2026-09-05').value, 1, '启用当日只计启用后的访问')
      assert.equal(point(result.metrics.visits.series, '2026-09-05').coverage, 'partial')
      assert.equal(point(result.metrics.visits.series, '2026-09-06').value, 0, '完整覆盖日允许为零')
      assert.equal(point(result.metrics.visits.series, '2026-09-06').coverage, 'complete')
      assert.equal(result.metrics.visits.totals.today.value, 1, 'asOf 时刻事件应计入当天')
      assert.equal(result.metrics.visits.totals.days7.value, 2)
      assert.equal(result.metrics.visits.totals.days7.coverage, 'partial')
      assert.equal(result.metrics.visits.totals.days30.value, 2)
      assert.equal(result.metrics.visits.totals.days30.coverage, 'partial')
      assert.equal(result.visitCollectionStartedAt, new Date(collectionStart).toISOString())
    } finally {
      // 无论断言成功或失败均回滚：临时表、样本事件和状态行不会保留。
      await trx.rollback()
    }
    console.log('统计 SQL 时间窗口与访问采集覆盖边界验收通过（aa_jizhang_test，事务已回滚）。')
  } finally {
    await knex.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
