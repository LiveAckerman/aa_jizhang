export type PeriodKey = 'today' | 'days7' | 'days30'
export type MetricKey = 'registrations' | 'visits' | 'books' | 'transactions'
export type Coverage = 'complete' | 'partial' | 'not_collected'

export interface MetricTotal {
  value: number | null
  coverage: Coverage
}

export interface DailyPoint {
  date: string
  value: number | null
  coverage: Coverage
}

export interface DashboardMetric {
  key: MetricKey
  label: string
  description: string
  totals: Record<PeriodKey, MetricTotal>
  series: DailyPoint[]
}

export interface StatisticsDashboard {
  generatedAt: string
  timezone: 'Asia/Shanghai'
  periods: Array<{
    key: PeriodKey
    label: string
    from: string
    to: string
  }>
  metrics: Record<MetricKey, DashboardMetric>
  visitCollectionStartedAt: string | null
  visitNotice: string | null
}
