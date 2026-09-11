import type { Knex } from 'knex'
import type { PageHandler } from 'adminjs'
import type {
  Coverage,
  DailyPoint,
  DashboardMetric,
  MetricKey,
  PeriodKey,
  StatisticsDashboard,
} from './statistics.types.js'

const TIMEZONE = 'Asia/Shanghai' as const

type CoreRow = {
  day: string
  registrations: string | number
  books: string | number
  transactions: string | number
}

type VisitRow = {
  day: string
  visits: string | number | null
  coverage: Coverage
}

const CORE_STATS_SQL = `
WITH bounds AS (
  SELECT
    ?::timestamptz AS as_of,
    timezone('Asia/Shanghai', ?::timestamptz)::date AS today
),
days AS (
  SELECT generate_series(today - 29, today, interval '1 day')::date AS day
  FROM bounds
),
user_daily AS (
  SELECT timezone('Asia/Shanghai', "createdAt")::date AS day, count(*) AS value
  FROM users, bounds
  WHERE "createdAt" >= ((today - 29)::timestamp AT TIME ZONE 'Asia/Shanghai')
    AND "createdAt" <= bounds.as_of
  GROUP BY 1
),
book_daily AS (
  SELECT timezone('Asia/Shanghai', "createdAt")::date AS day, count(*) AS value
  FROM books, bounds
  WHERE "createdAt" >= ((today - 29)::timestamp AT TIME ZONE 'Asia/Shanghai')
    AND "createdAt" <= bounds.as_of
  GROUP BY 1
),
transaction_daily AS (
  SELECT timezone('Asia/Shanghai', "createdAt")::date AS day, count(*) AS value
  FROM transactions, bounds
  WHERE "createdAt" >= ((today - 29)::timestamp AT TIME ZONE 'Asia/Shanghai')
    AND "createdAt" <= bounds.as_of
  GROUP BY 1
)
SELECT
  to_char(days.day, 'YYYY-MM-DD') AS day,
  coalesce(user_daily.value, 0) AS registrations,
  coalesce(book_daily.value, 0) AS books,
  coalesce(transaction_daily.value, 0) AS transactions
FROM days
LEFT JOIN user_daily USING (day)
LEFT JOIN book_daily USING (day)
LEFT JOIN transaction_daily USING (day)
ORDER BY days.day
`

const VISIT_STATS_SQL = `
WITH bounds AS (
  SELECT
    ?::timestamptz AS as_of,
    timezone('Asia/Shanghai', ?::timestamptz)::date AS today
),
collection AS (
  SELECT ?::timestamptz AS started_at
),
days AS (
  SELECT generate_series(today - 29, today, interval '1 day')::date AS day
  FROM bounds
),
visit_daily AS (
  SELECT timezone('Asia/Shanghai', created_at)::date AS day, count(*) AS value
  FROM app_visit_events, bounds, collection
  WHERE created_at >= greatest(
      collection.started_at,
      ((today - 29)::timestamp AT TIME ZONE 'Asia/Shanghai')
    )
    AND created_at <= bounds.as_of
  GROUP BY 1
)
SELECT
  to_char(days.day, 'YYYY-MM-DD') AS day,
  CASE
    WHEN collection.started_at > bounds.as_of
      OR ((days.day + 1)::timestamp AT TIME ZONE 'Asia/Shanghai') <= collection.started_at
      THEN NULL
    ELSE coalesce(visit_daily.value, 0)
  END AS visits,
  CASE
    WHEN collection.started_at > bounds.as_of
      OR ((days.day + 1)::timestamp AT TIME ZONE 'Asia/Shanghai') <= collection.started_at
      THEN 'not_collected'
    WHEN (days.day::timestamp AT TIME ZONE 'Asia/Shanghai') < collection.started_at
      THEN 'partial'
    ELSE 'complete'
  END AS coverage
FROM days
LEFT JOIN visit_daily USING (day)
CROSS JOIN bounds
CROSS JOIN collection
ORDER BY days.day
`

const PERIOD_LENGTHS: Record<PeriodKey, number> = {
  today: 1,
  days7: 7,
  days30: 30,
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: '今天',
  days7: '近 7 天',
  days30: '近 30 天',
}

const METRIC_META: Record<
  MetricKey,
  Pick<DashboardMetric, 'label' | 'description'>
> = {
  registrations: { label: '注册用户', description: '按用户注册时间统计' },
  visits: { label: '小程序访问', description: '每次进入或返回小程序记一次' },
  books: { label: '新建账本', description: '按账本创建时间统计' },
  transactions: { label: '记录账单', description: '按账单创建时间统计' },
}

const dateString = (value: unknown): string => String(value).slice(0, 10)

const sum = (points: DailyPoint[]): number =>
  points.reduce((total, point) => total + (point.value ?? 0), 0)

const createMetric = (
  key: MetricKey,
  series: DailyPoint[],
): DashboardMetric => {
  const totals = Object.fromEntries(
    (Object.keys(PERIOD_LENGTHS) as PeriodKey[]).map((period) => {
      const points = series.slice(-PERIOD_LENGTHS[period])
      const collected = points.filter((point) => point.value !== null)
      const coverage: Coverage = !collected.length
        ? 'not_collected'
        : collected.length < points.length || points.some((point) => point.coverage === 'partial')
          ? 'partial'
          : 'complete'
      return [
        period,
        {
          value: coverage === 'not_collected' ? null : sum(collected),
          coverage,
        },
      ]
    }),
  ) as Record<PeriodKey, { value: number | null; coverage: Coverage }>

  return { key, ...METRIC_META[key], totals, series }
}

const getVisitCollection = async (
  knex: Knex,
): Promise<{ startedAt: Date | null; notice: string | null }> => {
  const tables = (await knex.raw(`
    SELECT
      to_regclass('public.app_visit_events') IS NOT NULL AS events_exists,
      to_regclass('public.analytics_collection_status') IS NOT NULL AS status_exists
  `)) as { rows: Array<{ events_exists: boolean; status_exists: boolean }> }
  const state = tables.rows[0]
  if (!state?.events_exists || !state.status_exists) {
    return {
      startedAt: null,
      notice: '访问数据尚未开始采集，历史访问无法补录。',
    }
  }

  const status = (await knex('analytics_collection_status')
    .select('started_at')
    .where({ key: 'app_visits' })
    .first()) as { started_at: Date | string } | undefined
  if (!status) {
    return {
      startedAt: null,
      notice: '访问采集状态尚未就绪，暂不展示访问数。',
    }
  }
  return { startedAt: new Date(status.started_at), notice: null }
}

export const loadStatistics = async (
  knex: Knex,
  asOf: Date = new Date(),
): Promise<StatisticsDashboard> => {
  const coreResult = (await knex.raw(CORE_STATS_SQL, [asOf, asOf])) as {
    rows: CoreRow[]
  }
  const coreRows = coreResult.rows
  if (coreRows.length !== 30) throw new Error('统计日期序列不完整')

  const makeCoreSeries = (
    field: 'registrations' | 'books' | 'transactions',
  ): DailyPoint[] =>
    coreRows.map((row) => ({
      date: dateString(row.day),
      value: Number(row[field]),
      coverage: 'complete',
    }))

  const visitCollection = await getVisitCollection(knex)
  let visitSeries: DailyPoint[]
  if (!visitCollection.startedAt) {
    visitSeries = coreRows.map((row) => ({
      date: dateString(row.day),
      value: null,
      coverage: 'not_collected',
    }))
  } else {
    const visitResult = (await knex.raw(VISIT_STATS_SQL, [
      asOf,
      asOf,
      visitCollection.startedAt,
    ])) as { rows: VisitRow[] }
    visitSeries = visitResult.rows.map((row) => {
      const date = dateString(row.day)
      return {
        date,
        value: row.visits === null ? null : Number(row.visits),
        coverage: row.coverage,
      }
    })
  }

  const today = dateString(coreRows.at(-1)?.day)
  const metrics = {
    registrations: createMetric('registrations', makeCoreSeries('registrations')),
    visits: createMetric('visits', visitSeries),
    books: createMetric('books', makeCoreSeries('books')),
    transactions: createMetric('transactions', makeCoreSeries('transactions')),
  }
  const periods = (Object.keys(PERIOD_LENGTHS) as PeriodKey[]).map((key) => ({
    key,
    label: PERIOD_LABELS[key],
    from: coreRows.at(-PERIOD_LENGTHS[key])
      ? dateString(coreRows.at(-PERIOD_LENGTHS[key])?.day)
      : today,
    to: today,
  }))

  return {
    generatedAt: asOf.toISOString(),
    timezone: TIMEZONE,
    periods,
    metrics,
    visitCollectionStartedAt: visitCollection.startedAt?.toISOString() ?? null,
    visitNotice: visitCollection.notice,
  }
}

export const createStatisticsHandler = (knex: Knex): PageHandler =>
  async () => loadStatistics(knex)
