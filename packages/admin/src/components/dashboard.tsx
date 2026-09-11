import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient } from 'adminjs'
import {
  Badge,
  Box,
  Button,
  H2,
  Loader,
  MessageBox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Text,
} from '@adminjs/design-system'
import type {
  Coverage,
  DashboardMetric,
  MetricKey,
  PeriodKey,
  StatisticsDashboard,
} from '../statistics.types.js'

const api = new ApiClient()
const metricOrder: MetricKey[] = ['registrations', 'visits', 'books', 'transactions']
const periodOrder: PeriodKey[] = ['today', 'days7', 'days30']
const periodLength: Record<PeriodKey, number> = { today: 1, days7: 7, days30: 30 }
const number = new Intl.NumberFormat('zh-CN')
const coverageText: Record<Coverage, string> = {
  complete: '完整',
  partial: '部分采集',
  not_collected: '未采集',
}

const styles = `
.aa-dashboard { box-sizing:border-box; width:100%; min-width:0; min-height:100%; padding:24px; background:inherit; font-family:inherit; }
.aa-dashboard * { box-sizing:border-box; } .aa-content { max-width:1240px; margin:0 auto; } .aa-sr-only { position:absolute!important; width:1px!important; height:1px!important; padding:0!important; margin:-1px!important; overflow:hidden!important; clip:rect(0,0,0,0)!important; white-space:nowrap!important; border:0!important; } .aa-table-wrap { overflow-x:auto; } .aa-table-wrap th, .aa-table-wrap td, .aa-daily-wrap th, .aa-daily-wrap td { text-align:left; vertical-align:top; } .aa-metric-value { font-variant-numeric:tabular-nums; font-weight:600; white-space:nowrap; } .aa-controls { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px 24px; } .aa-control-group { display:flex; flex-wrap:wrap; gap:8px; } .aa-trend { position:relative; min-height:294px; padding:24px 16px 12px; } .aa-plot { position:relative; padding-left:42px; } .aa-chart { height:210px; display:grid; grid-template-columns:repeat(var(--point-count), minmax(0, 1fr)); align-items:end; gap:clamp(2px, .75vw, 10px); border-bottom:1px solid currentColor; color:inherit; background:linear-gradient(to bottom, transparent 49.5%, currentColor 50%, transparent 50.5%); opacity:.82; } .aa-y-axis { position:absolute; inset:0 auto 0 0; width:34px; display:flex; flex-direction:column; justify-content:space-between; color:inherit; font-size:11px; text-align:right; font-variant-numeric:tabular-nums; opacity:.72; } .aa-bar-slot { height:100%; display:flex; align-items:flex-end; min-width:0; } .aa-bar { width:100%; background:currentColor; transition:height .18s ease; } .aa-bar-missing { width:100%; height:100%; background:repeating-linear-gradient(135deg, transparent 0 5px, currentColor 5px 6px); opacity:.22; } .aa-axis { display:grid; grid-template-columns:repeat(var(--point-count), minmax(0, 1fr)); gap:clamp(2px, .75vw, 10px); margin-top:8px; color:inherit; font-size:10px; opacity:.72; } .aa-axis span { overflow:visible; white-space:nowrap; } .aa-empty { position:absolute; inset:106px 0 auto; text-align:center; } .aa-daily-wrap { max-height:320px; overflow:auto; } .aa-daily-head { position:sticky; top:0; z-index:1; }
@media (max-width:720px) { .aa-dashboard { padding:16px; } .aa-header { display:block!important; } .aa-header-actions { margin-top:16px; } .aa-controls { display:block; } .aa-control-group + .aa-control-group { margin-top:10px; } .aa-trend { min-height:270px; padding-left:6px; padding-right:6px; } .aa-chart { height:180px; } .aa-empty { inset:92px 0 auto; } } @media (prefers-reduced-motion:reduce) { .aa-bar { transition:none; } }
`
const formatDate = (date: string): string => date.slice(5).replace('-', '/')
const CoverageBadge = ({ coverage }: { coverage: Coverage }) =>
  coverage === 'complete' ? null : (
    <Badge variant={coverage === 'partial' ? 'warning' : 'info'} size="sm">
      {coverageText[coverage]}
    </Badge>
  )
const StatCell = ({ metric, period }: { metric: DashboardMetric; period: PeriodKey }) => {
  const total = metric.totals[period]
  return (
    <TableCell>
      <Text className="aa-metric-value">
        {total.value === null ? '—' : number.format(total.value)}
      </Text>
      <Box mt="sm">
        <CoverageBadge coverage={total.coverage} />
      </Box>
    </TableCell>
  )
}
const Loading = () => (
  <Box variant="white" p="xxl" textAlign="center" role="status" aria-live="polite" aria-busy="true">
    <Loader />
    <Text mt="lg">正在加载最近 30 天的统计数据…</Text>
  </Box>
)

const Dashboard = () => {
  const [data, setData] = useState<StatisticsDashboard | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [metricKey, setMetricKey] = useState<MetricKey>('transactions')
  const [periodKey, setPeriodKey] = useState<PeriodKey>('days30')
  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await api.getDashboard()
      setData(response.data as StatisticsDashboard)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  const points = useMemo(
    () => (data ? data.metrics[metricKey].series.slice(-periodLength[periodKey]) : []),
    [data, metricKey, periodKey],
  )
  const max = Math.max(0, ...points.map((point) => point.value ?? 0))
  const chartMax = Math.max(2, Math.ceil(max / 2) * 2)
  const allZero =
    points.some((point) => point.value !== null) &&
    points.every((point) => (point.value ?? 0) === 0)
  const allNotCollected = points.length > 0 && points.every((point) => point.value === null)
  const selectedCoverage = data?.metrics[metricKey].totals[periodKey].coverage
  return (
    <main className="aa-dashboard">
      <style>{styles}</style>
      <Box className="aa-content">
        {loading && <Loading />}
        {!loading && error && (
          <Box variant="white" p="xxl" maxWidth="720px" mx="auto" role="alert">
            <MessageBox variant="danger" message="统计数据暂时无法加载">
              异常不会被当作 0 展示。请稍后重试。
            </MessageBox>
            <Button mt="lg" type="button" onClick={() => void load()}>
              重新加载
            </Button>
          </Box>
        )}
        {!loading && !error && data && (
          <>
            <Box
              variant="white"
              p={['lg', 'xl', 'xxl']}
              className="aa-header"
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
            >
              <Box>
                <H2>数据统计</H2>
                <Text mt="default" color="grey60">
                  查看最近 30 天的业务活动和每日趋势。
                </Text>
              </Box>
              <Box className="aa-header-actions" textAlign={['left', 'right']}>
                <Text fontSize="sm" color="grey60">
                  北京时间 · 更新于{' '}
                  {new Intl.DateTimeFormat('zh-CN', {
                    timeZone: data.timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                    hour12: false,
                  }).format(new Date(data.generatedAt))}
                </Text>
                <Button
                  variant="outlined"
                  size="sm"
                  mt="default"
                  type="button"
                  onClick={() => void load()}
                >
                  刷新数据
                </Button>
              </Box>
            </Box>
            <Box variant="white" p={['lg', 'xl', 'xxl']} mt="xl">
              <H2 as="h2" fontSize="h4">
                关键指标
              </H2>
              <Text mt="sm" mb="lg" color="grey60">
                所有区间均含今天，并截止当前时刻。
              </Text>
              <div className="aa-table-wrap">
                <Table width="100%">
                  <TableHead>
                    <TableRow>
                      <TableCell as="th">时间范围</TableCell>
                      {metricOrder.map((key) => (
                        <TableCell as="th" key={key}>
                          {data.metrics[key].label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {periodOrder.map((period) => {
                      const info = data.periods.find((item) => item.key === period)!
                      return (
                        <TableRow key={period}>
                          <TableCell as="th">
                            <Text fontWeight="bold">{info.label}</Text>
                            <Text fontSize="sm" color="grey60">
                              {formatDate(info.from)} — {formatDate(info.to)}
                            </Text>
                          </TableCell>
                          {metricOrder.map((key) => (
                            <StatCell key={key} metric={data.metrics[key]} period={period} />
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {(data.visitNotice || data.visitCollectionStartedAt) && (
                <MessageBox mt="xl" variant="info" message="访问数据覆盖说明">
                  {data.visitNotice ??
                    `采集从 ${new Intl.DateTimeFormat('zh-CN', { timeZone: data.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.visitCollectionStartedAt!))} 开始；发布延迟、断网或上报失败可能使数据不完整。`}
                </MessageBox>
              )}
            </Box>
            <Box variant="white" p={['lg', 'xl', 'xxl']} mt="xl">
              <H2 as="h2" fontSize="h4">
                每日趋势
              </H2>
              <Text mt="sm" mb="lg" color="grey60">
                {data.metrics[metricKey].description}
              </Text>
              <div className="aa-controls">
                <div className="aa-control-group" aria-label="选择指标">
                  {metricOrder.map((key) => (
                    <Button
                      variant={metricKey === key ? 'contained' : 'outlined'}
                      size="sm"
                      type="button"
                      aria-pressed={metricKey === key}
                      onClick={() => setMetricKey(key)}
                      key={key}
                    >
                      {data.metrics[key].label}
                    </Button>
                  ))}
                </div>
                <div className="aa-control-group" aria-label="选择时间范围">
                  {periodOrder.map((key) => (
                    <Button
                      variant={periodKey === key ? 'contained' : 'outlined'}
                      size="sm"
                      type="button"
                      aria-pressed={periodKey === key}
                      onClick={() => setPeriodKey(key)}
                      key={key}
                    >
                      {data.periods.find((item) => item.key === key)?.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Box className="aa-trend" color="primary100">
                <div className="aa-plot">
                  <div className="aa-y-axis" aria-hidden="true">
                    <span>{number.format(chartMax)}</span>
                    <span>{number.format(chartMax / 2)}</span>
                    <span>0</span>
                  </div>
                  <div
                    className="aa-chart"
                    role="img"
                    aria-label={`${data.metrics[metricKey].label}${data.periods.find((item) => item.key === periodKey)?.label}每日趋势`}
                    style={{ '--point-count': points.length } as React.CSSProperties}
                  >
                    {points.map((point) => (
                      <div
                        className="aa-bar-slot"
                        key={point.date}
                        title={`${point.date}：${point.value === null ? coverageText[point.coverage] : number.format(point.value)}`}
                      >
                        <div
                          className={point.value === null ? 'aa-bar-missing' : 'aa-bar'}
                          style={
                            point.value === null
                              ? undefined
                              : {
                                  height: `${point.value === 0 ? 0 : (point.value / chartMax) * 100}%`,
                                }
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    className="aa-axis"
                    aria-hidden="true"
                    style={{ '--point-count': points.length } as React.CSSProperties}
                  >
                    {points.map((point, index) => (
                      <span key={point.date}>
                        {points.length <= 7 ||
                        index === 0 ||
                        index === points.length - 1 ||
                        index % 5 === 0
                          ? formatDate(point.date)
                          : ''}
                      </span>
                    ))}
                  </div>
                </div>
                {allNotCollected && (
                  <div className="aa-empty">
                    <Text fontWeight="bold">这段时间尚未采集</Text>
                    <Text fontSize="sm">没有足够数据绘制趋势。</Text>
                  </div>
                )}
                {allZero && !allNotCollected && (
                  <div className="aa-empty">
                    <Text fontWeight="bold">已采集部分暂无新增</Text>
                    <Text fontSize="sm">
                      {selectedCoverage === 'complete'
                        ? '当前区间数据完整，数值为 0。'
                        : '只代表已经开始采集的时间段。'}
                    </Text>
                  </div>
                )}
              </Box>
              <Box mt="xl">
                <details>
                  <summary>查看每日明细</summary>
                  <div className="aa-daily-wrap">
                    <Table width="100%">
                      <caption className="aa-sr-only">
                        {data.metrics[metricKey].label}每日数据
                      </caption>
                      <TableHead className="aa-daily-head">
                        <TableRow>
                          <TableCell as="th">日期</TableCell>
                          <TableCell as="th">数值</TableCell>
                          <TableCell as="th">采集状态</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...points].reverse().map((point) => (
                          <TableRow key={point.date}>
                            <TableCell>{point.date}</TableCell>
                            <TableCell>
                              {point.value === null ? '—' : number.format(point.value)}
                            </TableCell>
                            <TableCell>
                              {point.coverage === 'complete' ? (
                                '完整'
                              ) : (
                                <CoverageBadge coverage={point.coverage} />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              </Box>
            </Box>
            <Box
              variant="white"
              p={['lg', 'xl', 'xxl']}
              mt="xl"
              mb="xl"
              display={['block', 'flex']}
            >
              <Box flex={1}>
                <Text fontWeight="bold">日期口径</Text>
                <Text fontSize="sm" color="grey60">
                  Asia/Shanghai 自然日；今天从 00:00 统计到当前时刻，近 7 天和近 30 天均含今天。
                </Text>
              </Box>
              <Box flex={1} mt={['lg', 0]} ml={[0, 'xxl']}>
                <Text fontWeight="bold">数据口径</Text>
                <Text fontSize="sm" color="grey60">
                  注册、账本、账单均按创建时间统计；已删除的历史记录无法回溯。访问数从采集状态记录时间起算，历史不可补。
                </Text>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </main>
  )
}
export default Dashboard
