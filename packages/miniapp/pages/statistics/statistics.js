const app = getApp()
const api = require('/utils/api')
const { setTabBarSelected } = require('/utils/tabbar')
const { requireLogin } = require('/utils/auth')
const authDrawerBehavior = require('/utils/auth-drawer-behavior')
const echarts = require('/components/ec-canvas/echarts')

// 分类条形色（跟主色系一致，柔和有层次）
const CAT_COLORS = ['#4097a9', '#68b7c7', '#8dd3e0', '#f0a58e', '#fa9583', '#c7a8e0', '#a0d8b3', '#f5c67c', '#b0b8c9']

const RANGES = [
  { key: 'month', name: '本月' },
  { key: '3m', name: '近 3 月' },
  { key: 'year', name: '今年' },
  { key: 'all', name: '全部' },
]

const RANGE_LABELS = {
  month: '本月',
  '3m': '近 3 月',
  year: '今年',
  all: '全部',
}

Page({
  behaviors: [authDrawerBehavior],
  data: {
    scope: 'mine',
    scopeLabel: '我的支出',
    range: 'month',
    rangeLabel: '本月',
    ranges: RANGES,
    totalText: '0.00',
    count: 0,
    prevDelta: null,
    prevDeltaText: '',
    categories: [],
    hasMonthly: false,
    loading: true,
    isGuest: false, // 未登录游客态：展示登录引导，不强制跳转
    ec: { lazyLoad: true },
    monthly: [],

    // 账本筛选
    bookOptions: [{ id: 'all', name: '全部账本' }], // picker 数据源
    bookIndex: 0,   // 当前 picker 选中项
    bookId: 'all',
    bookLabel: '全部账本',
  },

  onLoad() {
    this.chartInited = false
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '统计' })
    setTabBarSelected(this, 1)

    // 微信审核要求：未登录也可进入统计页浏览，不强制跳转登录。
    // 游客态展示登录引导空状态，点击「去登录」时才引导登录。
    if (!app.isLoggedIn()) {
      this.setData({ isGuest: true, loading: false })
      return
    }
    this.setData({ isGuest: false })

    // 从账本详情跳转过来：定位到指定账本（switchTab 无法传参，走全局变量）
    const target = app.globalData.statsTargetBookId
    if (target) {
      app.globalData.statsTargetBookId = null
      this.setData({ bookId: target })
    }

    this.loadBooks()
    this.load()
    this.maybeShowAuthDrawer()
  },

  // 游客态「去登录」按钮
  onGuestLogin() {
    requireLogin()
  },

  async loadBooks() {
    try {
      const books = await api.listBooks()
      const opts = [{ id: 'all', name: '全部账本' }].concat(
        (books || []).map((b) => ({ id: b.id, name: b.name })),
      )
      // 保留/应用当前选中项（可能来自账本详情跳转）
      const idx = Math.max(0, opts.findIndex((o) => o.id === this.data.bookId))
      const cur = opts[idx] || opts[0]
      this.setData({ bookOptions: opts, bookIndex: idx, bookLabel: cur.name })
    } catch (e) {}
  },

  onBookChange(e) {
    const idx = Number(e.detail.value)
    const opt = this.data.bookOptions[idx]
    if (!opt) return
    if (opt.id === this.data.bookId) return
    this.setData({
      bookIndex: idx,
      bookId: opt.id,
      bookLabel: opt.name,
      loading: true,
    })
    this.load()
  },

  onScope(e) {
    const scope = e.currentTarget.dataset.scope
    if (scope === this.data.scope) return
    this.setData({ scope, scopeLabel: scope === 'mine' ? '我的支出' : '团队公账', loading: true })
    this.load()
  },

  onRange(e) {
    const range = e.currentTarget.dataset.key
    if (range === this.data.range) return
    this.setData({ range, rangeLabel: RANGE_LABELS[range], loading: true })
    this.load()
  },

  async load() {
    // 游客态防御性守卫：交互控件虽在 wx:else 内不渲染，仍在代码层拦截，避免未登录发起统计请求
    if (this.data.isGuest) return
    try {
      const data = await api.statsOverview(this.data.range, this.data.scope, this.data.bookId)
      const categories = (data.categories || []).map((c, i) => ({
        ...c,
        color: CAT_COLORS[i % CAT_COLORS.length],
        amountText: (c.amount / 100).toFixed(2),
      }))
      const monthly = data.monthly || []
      const hasMonthly = monthly.some((m) => m.amount > 0)
      this.setData({
        totalText: ((data.total || 0) / 100).toFixed(2),
        count: data.count || 0,
        prevDelta: data.prevDelta,
        prevDeltaText: data.prevDelta !== null ? Math.abs(data.prevDelta).toFixed(1) : '',
        categories,
        monthly,
        hasMonthly,
        loading: false,
      })
      if (hasMonthly) this.renderMonthly(monthly)
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    }
  },

  renderMonthly(monthly) {
    const ecComp = this.selectComponent('#monthlyChart')
    if (!ecComp) return
    ecComp.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: dpr,
      })
      canvas.setChart(chart)
      chart.setOption(this.buildMonthlyOption(monthly))
      this.chart = chart
      return chart
    })
  },

  buildMonthlyOption(monthly) {
    return {
      grid: { left: 40, right: 16, top: 24, bottom: 30 },
      xAxis: {
        type: 'category',
        data: monthly.map((m) => m.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#c4cdd6' } },
        axisLabel: { color: '#8091a5', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#eef1f5' } },
        axisLabel: {
          color: '#8091a5',
          fontSize: 10,
          formatter: (v) => (v >= 100 ? (v / 100).toFixed(0) : (v / 100).toFixed(1)),
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          data: monthly.map((m) => m.amount),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#4097a9' },
                { offset: 1, color: '#68b7c7' },
              ],
            },
            borderRadius: [8, 8, 0, 0],
          },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(47, 65, 89, 0.92)',
        borderWidth: 0,
        padding: [8, 12],
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (p) => {
          const v = p[0] ? p[0].value : 0
          return `${p[0].axisValue}\n¥${(v / 100).toFixed(2)}`
        },
      },
    }
  },

  // 分享到聊天
  onShareAppMessage() {
    return {
      title: '一起分账吧 - 多人记账小程序',
      path: '/pages/statistics/statistics',
      imageUrl: 'https://cdn.ljw44.com/assets/share/share-2.jpg',
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '一起分账吧 - 多人记账小程序',
      query: '',
      imageUrl: 'https://cdn.ljw44.com/assets/share/share-2.jpg',
    }
  },
})
