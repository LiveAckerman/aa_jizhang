import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient } from 'adminjs'
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
  complete: '',
  partial: '部分采集',
  not_collected: '未采集',
}

const styles = `
.aa-dashboard { --paper:#f3efe3; --paper-deep:#e9e2d2; --ink:#183b31; --ink-soft:#52685f; --line:#cfc6b3; --accent:#a95135; box-sizing:border-box; flex:none; width:100%; min-width:0; min-height:100%; margin:0; padding:clamp(24px,4vw,58px); overflow-x:hidden; color:var(--ink); background-color:var(--paper); background-image:linear-gradient(rgba(24,59,49,.035) 1px,transparent 1px); background-size:100% 32px; font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif; }
.aa-dashboard * { box-sizing:border-box; }
.aa-sr-only { position:absolute!important; width:1px!important; height:1px!important; padding:0!important; margin:-1px!important; overflow:hidden!important; clip:rect(0,0,0,0)!important; white-space:nowrap!important; border:0!important; }
.aa-report { width:100%; min-width:0; max-width:1180px; margin:0 auto; }
.aa-masthead { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:32px; align-items:end; border-top:5px solid var(--ink); border-bottom:1px solid var(--ink); padding:22px 0 18px; }
.aa-kicker { display:flex; align-items:center; gap:10px; margin:0 0 12px; color:var(--accent); font-size:12px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; }
.aa-kicker::before { content:""; width:34px; border-top:2px solid currentColor; }
.aa-title { margin:0; font-family:"Songti SC","STSong","Noto Serif CJK SC",serif; font-size:clamp(34px,5vw,64px); font-weight:700; letter-spacing:-.045em; line-height:.98; }
.aa-subtitle { max-width:620px; margin:14px 0 0; color:var(--ink-soft); font-size:14px; line-height:1.8; }
.aa-updated { text-align:right; color:var(--ink-soft); font-size:12px; line-height:1.7; }
.aa-refresh { display:block; margin:6px 0 0 auto; padding:3px 0; border:0; border-bottom:1px solid var(--ink); border-radius:0; color:var(--ink); background:transparent; font:inherit; font-weight:700; cursor:pointer; }
.aa-refresh:hover { color:var(--accent); border-color:var(--accent); }
.aa-section { margin-top:clamp(34px,5vw,64px); }
.aa-section-head { display:flex; align-items:baseline; justify-content:space-between; gap:20px; margin-bottom:14px; }
.aa-section-title { margin:0; font-family:"Songti SC","STSong","Noto Serif CJK SC",serif; font-size:clamp(22px,3vw,32px); }
.aa-section-note { margin:0; color:var(--ink-soft); font-size:12px; }
.aa-matrix-wrap { overflow-x:auto; border-top:1px solid var(--ink); border-bottom:1px solid var(--ink); }
.aa-matrix { width:100%; min-width:720px; border-collapse:collapse; table-layout:fixed; }
.aa-matrix th,.aa-matrix td { border-right:1px solid var(--line); border-bottom:1px solid var(--line); padding:18px 20px; text-align:left; vertical-align:top; }
.aa-matrix th:last-child,.aa-matrix td:last-child { border-right:0; }
.aa-matrix tr:last-child th,.aa-matrix tr:last-child td { border-bottom:0; }
.aa-matrix thead th { color:var(--ink-soft); font-size:12px; font-weight:700; letter-spacing:.08em; }
.aa-matrix thead th:first-child { width:150px; }
.aa-period-label { font-family:"Songti SC","STSong",serif; font-size:18px; }
.aa-period-dates { display:block; margin-top:7px; color:var(--ink-soft); font-family:inherit; font-size:10px; font-weight:400; }
.aa-value { display:block; font-family:"Songti SC","STSong",serif; font-size:clamp(25px,3vw,38px); font-variant-numeric:tabular-nums; line-height:1; }
.aa-coverage { display:block; min-height:18px; margin-top:8px; color:var(--accent); font-size:11px; font-weight:700; }
.aa-cell-muted .aa-value { color:#887f70; }
.aa-controls { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px 24px; padding:12px 0; border-top:1px solid var(--ink); border-bottom:1px solid var(--line); }
.aa-control-group { display:flex; flex-wrap:wrap; gap:4px; }
.aa-tab { min-height:44px; padding:9px 14px; border:1px solid transparent; border-radius:0; color:var(--ink-soft); background:transparent; font:inherit; font-size:13px; cursor:pointer; }
.aa-tab:hover { color:var(--ink); border-color:var(--line); }
.aa-tab[aria-pressed="true"] { color:var(--paper); background:var(--ink); }
.aa-trend { position:relative; min-height:330px; padding:38px 8px 8px; border-bottom:1px solid var(--ink); }
.aa-plot { position:relative; padding-left:42px; }
.aa-chart { height:230px; display:grid; grid-template-columns:repeat(var(--point-count),minmax(9px,1fr)); align-items:end; gap:clamp(3px,.75vw,10px); border-bottom:1px solid var(--line); background:linear-gradient(to bottom,transparent 49.7%,var(--line) 50%,transparent 50.3%); }
.aa-y-axis { position:absolute; inset:0 auto 0 0; width:36px; display:flex; flex-direction:column; justify-content:space-between; padding-bottom:0; color:var(--ink-soft); font-size:9px; text-align:right; font-variant-numeric:tabular-nums; }
.aa-bar-slot { height:100%; display:flex; align-items:flex-end; position:relative; }
.aa-bar { width:100%; min-height:2px; background:var(--ink); transform-origin:bottom; animation:aa-rise .55s cubic-bezier(.22,1,.36,1) both; }
.aa-bar-slot:nth-child(4n+2) .aa-bar { background:#315e50; }
.aa-bar-missing { height:100%; width:100%; opacity:.45; background:repeating-linear-gradient(135deg,transparent 0 5px,var(--line) 5px 6px); }
.aa-axis { display:grid; grid-template-columns:repeat(var(--point-count),minmax(9px,1fr)); gap:clamp(3px,.75vw,10px); margin-top:9px; color:var(--ink-soft); font-size:9px; }
.aa-axis span { white-space:nowrap; transform:translateX(-2px); }
.aa-empty { position:absolute; inset:95px 0 auto; text-align:center; color:var(--ink-soft); }
.aa-empty strong { display:block; color:var(--ink); font-family:"Songti SC","STSong",serif; font-size:22px; }
.aa-footnotes { display:grid; grid-template-columns:1fr 1fr; gap:24px 48px; margin-top:42px; padding-top:18px; border-top:1px solid var(--line); color:var(--ink-soft); font-size:12px; line-height:1.8; }
.aa-footnotes strong { color:var(--ink); }
.aa-notice { margin:20px 0 0; padding:12px 0; border-bottom:1px solid var(--accent); color:var(--accent); font-size:12px; }
.aa-details { margin-top:20px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.aa-details summary { min-height:44px; display:flex; align-items:center; color:var(--ink); font-size:13px; font-weight:700; cursor:pointer; }
.aa-daily-wrap { max-height:280px; overflow:auto; border-top:1px solid var(--line); }
.aa-daily { width:100%; border-collapse:collapse; font-size:12px; }
.aa-daily th,.aa-daily td { padding:10px 8px; border-bottom:1px solid var(--line); text-align:left; font-variant-numeric:tabular-nums; }
.aa-daily th { position:sticky; top:0; color:var(--ink-soft); background:var(--paper); }
.aa-state { max-width:720px; margin:80px auto; padding:34px 0; border-top:4px solid var(--ink); border-bottom:1px solid var(--ink); }
.aa-state h2 { margin:0 0 12px; font-family:"Songti SC","STSong",serif; font-size:30px; }
.aa-state p { color:var(--ink-soft); line-height:1.7; }
.aa-skeleton { height:13px; margin:13px 0; background:var(--paper-deep); animation:aa-pulse 1.4s ease-in-out infinite; }
.aa-retry { min-height:42px; padding:9px 18px; border:0; color:var(--paper); background:var(--ink); font:inherit; cursor:pointer; }
.aa-refresh:focus-visible,.aa-tab:focus-visible,.aa-retry:focus-visible { outline:3px solid color-mix(in srgb,var(--accent) 75%,transparent); outline-offset:3px; }
@keyframes aa-rise { from { opacity:.3; transform:scaleY(.08); } to { opacity:1; transform:scaleY(1); } }
@keyframes aa-pulse { 50% { opacity:.4; } }
@media (max-width:720px) { .aa-dashboard { padding:20px 16px 40px; } .aa-masthead { grid-template-columns:1fr; gap:16px; } .aa-updated { text-align:left; } .aa-refresh { margin-left:0; min-height:44px; } .aa-section-head { display:block; } .aa-section-note { margin-top:6px; } .aa-controls { display:block; } .aa-control-group + .aa-control-group { margin-top:8px; } .aa-trend { min-height:290px; padding-top:28px; } .aa-chart { height:190px; } .aa-footnotes { grid-template-columns:1fr; gap:10px; } }
@media (prefers-reduced-motion:reduce) { .aa-bar,.aa-skeleton { animation:none; } }
`

const formatDate = (date: string): string => date.slice(5).replace('-', '/')

const StatCell = ({ metric, period }: { metric: DashboardMetric; period: PeriodKey }) => {
  const total = metric.totals[period]
  return (
    <td className={total.value === null ? 'aa-cell-muted' : undefined}>
      <span className="aa-value">{total.value === null ? '—' : number.format(total.value)}</span>
      <span className="aa-coverage">{coverageText[total.coverage]}</span>
    </td>
  )
}

const Loading = () => (
  <div className="aa-state" role="status" aria-live="polite" aria-busy="true">
    <h2>正在整理报表</h2>
    <p>汇总北京时间下的最近 30 天数据。</p>
    <div className="aa-skeleton" />
    <div className="aa-skeleton" style={{ width: '76%' }} />
    <div className="aa-skeleton" style={{ width: '54%' }} />
  </div>
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

  useEffect(() => { void load() }, [load])

  const points = useMemo(() => {
    if (!data) return []
    return data.metrics[metricKey].series.slice(-periodLength[periodKey])
  }, [data, metricKey, periodKey])
  const max = Math.max(0, ...points.map((point) => point.value ?? 0))
  const chartMax = Math.max(2, Math.ceil(max / 2) * 2)
  const allZero = points.some((point) => point.value !== null)
    && points.every((point) => (point.value ?? 0) === 0)
  const allNotCollected = points.every((point) => point.value === null)
  const selectedCoverage = data?.metrics[metricKey].totals[periodKey].coverage

  return (
    <main className="aa-dashboard">
      <style>{styles}</style>
      <div className="aa-report">
        {loading && <Loading />}
        {!loading && error && (
          <div className="aa-state" role="alert">
            <h2>报表暂时无法加载</h2>
            <p>统计数据暂时没有返回。请稍后重试，异常不会被当作 0 展示。</p>
            <button className="aa-retry" type="button" onClick={() => void load()}>重新加载</button>
          </div>
        )}
        {!loading && !error && data && (
          <>
            <header className="aa-masthead">
              <div>
                <p className="aa-kicker">30D · 运营台账</p>
                <h1 className="aa-title">数据概览</h1>
                <p className="aa-subtitle">从注册到记账，用一张表看清最近一个月的真实活动。</p>
              </div>
              <div className="aa-updated">
                北京时间 · 更新于 {new Intl.DateTimeFormat('zh-CN', {
                  timeZone: data.timezone, hour: '2-digit', minute: '2-digit',
                  month: '2-digit', day: '2-digit', hour12: false,
                }).format(new Date(data.generatedAt))}
                <button className="aa-refresh" type="button" onClick={() => void load()}>刷新数据</button>
              </div>
            </header>

            <section className="aa-section" aria-labelledby="matrix-title">
              <div className="aa-section-head">
                <h2 className="aa-section-title" id="matrix-title">关键指标</h2>
                <p className="aa-section-note">所有区间均含今天，并截止当前时刻</p>
              </div>
              <div className="aa-matrix-wrap">
                <table className="aa-matrix">
                  <thead><tr><th scope="col">时间范围</th>{metricOrder.map((key) => <th scope="col" key={key}>{data.metrics[key].label}</th>)}</tr></thead>
                  <tbody>{periodOrder.map((period) => {
                    const info = data.periods.find((item) => item.key === period)!
                    return <tr key={period}><th scope="row"><span className="aa-period-label">{info.label}</span><span className="aa-period-dates">{formatDate(info.from)}—{formatDate(info.to)}</span></th>{metricOrder.map((key) => <StatCell key={key} metric={data.metrics[key]} period={period} />)}</tr>
                  })}</tbody>
                </table>
              </div>
              {(data.visitNotice || data.visitCollectionStartedAt) && <p className="aa-notice">访问数：{data.visitNotice ?? `采集状态起点为 ${new Intl.DateTimeFormat('zh-CN', { timeZone: data.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.visitCollectionStartedAt!))}。小程序发布延迟、断网或上报失败可能使起点后的数据仍不完整。`}</p>}
            </section>

            <section className="aa-section" aria-labelledby="trend-title">
              <div className="aa-section-head">
                <h2 className="aa-section-title" id="trend-title">每日趋势</h2>
                <p className="aa-section-note">{data.metrics[metricKey].description}</p>
              </div>
              <div className="aa-controls">
                <div className="aa-control-group" aria-label="选择指标">{metricOrder.map((key) => <button className="aa-tab" type="button" aria-pressed={metricKey === key} onClick={() => setMetricKey(key)} key={key}>{data.metrics[key].label}</button>)}</div>
                <div className="aa-control-group" aria-label="选择时间范围">{periodOrder.map((key) => <button className="aa-tab" type="button" aria-pressed={periodKey === key} onClick={() => setPeriodKey(key)} key={key}>{data.periods.find((item) => item.key === key)?.label}</button>)}</div>
              </div>
              <div className="aa-trend">
                <div className="aa-plot">
                  <div className="aa-y-axis" aria-hidden="true"><span>{number.format(chartMax)}</span><span>{number.format(chartMax / 2)}</span><span>0</span></div>
                  <div className="aa-chart" role="img" aria-label={`${data.metrics[metricKey].label}${data.periods.find((item) => item.key === periodKey)?.label}每日趋势`} style={{ '--point-count': points.length } as React.CSSProperties}>
                    {points.map((point, index) => <div className="aa-bar-slot" key={point.date} title={`${point.date}：${point.value === null ? coverageText[point.coverage] : number.format(point.value)}`}><div className={point.value === null ? 'aa-bar-missing' : 'aa-bar'} style={point.value === null ? undefined : { height: `${Math.max(1, (point.value / chartMax) * 100)}%`, animationDelay: `${Math.min(index * 18, 280)}ms` }} /></div>)}
                  </div>
                  <div className="aa-axis" aria-hidden="true" style={{ '--point-count': points.length } as React.CSSProperties}>{points.map((point, index) => <span key={point.date}>{points.length <= 7 || index === 0 || index === points.length - 1 || index % 5 === 0 ? formatDate(point.date) : ''}</span>)}</div>
                </div>
                {allNotCollected && <div className="aa-empty"><strong>这段时间尚未采集</strong>没有足够数据绘制趋势</div>}
                {allZero && !allNotCollected && <div className="aa-empty"><strong>已采集部分暂无新增</strong>{selectedCoverage === 'complete' ? '当前区间数据完整，数值为 0' : '只代表已经开始采集的时间段'}</div>}
              </div>
              <details className="aa-details"><summary>查看每日明细</summary><div className="aa-daily-wrap"><table className="aa-daily"><caption className="aa-sr-only">{data.metrics[metricKey].label}每日数据</caption><thead><tr><th>日期</th><th>数值</th><th>采集状态</th></tr></thead><tbody>{[...points].reverse().map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.value === null ? '—' : number.format(point.value)}</td><td>{coverageText[point.coverage] || '完整'}</td></tr>)}</tbody></table></div></details>
            </section>

            <footer className="aa-footnotes">
              <div><strong>日期口径</strong><br />Asia/Shanghai 自然日；今天从 00:00 统计到当前时刻，近 7 天和近 30 天均含今天。</div>
              <div><strong>数据口径</strong><br />注册、账本、账单均按创建时间统计；已删除的历史记录无法回溯。访问数从采集状态记录时间起算，历史不可补；移动端发布延迟可能使最初一段数据不完整。</div>
            </footer>
          </>
        )}
      </div>
    </main>
  )
}

export default Dashboard
