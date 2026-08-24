const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP } = require('../../constants/ledger')

Page({
  data: {
    bookId: '',
    bookName: '账本',
    myUserId: '',
    memberMap: {},        // userId -> nickname
    rawItems: [],         // 全部未结算公账（已附展示字段，未分组）
    groups: [],           // 按日期分组（经关键词过滤后）
    keyword: '',          // 搜索关键词（分类名 / 备注）
    checkedMap: {},        // txId -> true
    checkedCount: 0,
    checkedAmountText: '0.00',
    allChecked: false,
    loading: true,
    submitting: false,
  },

  onLoad(query) {
    let bookName = '账本'
    try {
      bookName = decodeURIComponent(query.bookName || '') || '账本'
    } catch (e) {
      bookName = query.bookName || '账本'
    }
    this.setData({
      bookId: query.bookId || '',
      bookName,
      myUserId: (app.globalData.user || {}).id || '',
    })
    this.loadData()
  },

  onShow() {
    // 从结算页返回（未确认）时刷新，避免展示已结算的陈旧账单；首次 onLoad 已触发一次，跳过
    if (this.data.bookId && !this.data.loading && this._loadedOnce) {
      this._recalc({}) // 清空勾选，防止对已变更列表的旧选择
      this.loadData()
    }
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const [book, txs] = await Promise.all([
        api.bookDetail(this.data.bookId),
        // 后端已过滤：仅与当前用户相关、仍有未结清份额的公账
        api.settleableTransactions(this.data.bookId),
      ])
      this._loadedOnce = true
      const memberMap = {}
      ;(book.members || []).forEach((m) => (memberMap[m.userId] = m.nickname))
      const list = txs || []
      const rawItems = list.map((t) => {
        const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.other
        return {
          id: t.id,
          amount: t.amount,
          amountText: (t.amount / 100).toFixed(2),
          spentAt: t.spentAt || '',
          categoryName: cat.name,
          categoryIcon: cat.icon,
          note: t.note || (memberMap[t.payerId] || '成员') + ' 付款',
        }
      })
      this.setData({ memberMap, rawItems, loading: false })
      this.applyFilter()
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 搜索输入：模糊匹配分类名 + 备注
  onSearch(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    this.applyFilter()
  },

  // 按关键词过滤 rawItems 并按日期分组；过滤后清理失效的勾选
  applyFilter() {
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const list = kw
      ? this.data.rawItems.filter(
          (it) =>
            (it.categoryName || '').toLowerCase().includes(kw) ||
            (it.note || '').toLowerCase().includes(kw),
        )
      : this.data.rawItems

    // 按日期分组
    const map = {}
    list.forEach((it) => {
      const d = it.spentAt ? it.spentAt.slice(0, 10) : ''
      if (!map[d]) map[d] = []
      map[d].push(it)
    })
    const groups = Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: map[date] }))

    this.setData({ groups }, () => this._recalc(this.data.checkedMap))
  },

  // 收集所有账单 id（扁平）
  _allIds() {
    const ids = []
    this.data.groups.forEach((g) => g.items.forEach((it) => ids.push(it.id)))
    return ids
  },

  // 计算选中数量与金额：以 rawItems 为准（含被搜索隐藏但仍勾选的项）
  _recalc(checkedMap) {
    let count = 0
    let amount = 0
    this.data.rawItems.forEach((it) => {
      if (checkedMap[it.id]) {
        count += 1
        amount += it.amount
      }
    })
    // allChecked 只反映「当前可见项是否全选」，方便搜索后对结果集全选
    const visibleIds = this._allIds()
    const allVisibleChecked =
      visibleIds.length > 0 && visibleIds.every((id) => checkedMap[id])
    this.setData({
      checkedMap,
      checkedCount: count,
      checkedAmountText: (amount / 100).toFixed(2),
      allChecked: allVisibleChecked,
    })
  },

  onToggle(e) {
    const { id } = e.currentTarget.dataset
    const checkedMap = { ...this.data.checkedMap }
    if (checkedMap[id]) delete checkedMap[id]
    else checkedMap[id] = true
    this._recalc(checkedMap)
  },

  onToggleAll() {
    if (this.data.allChecked) {
      this._recalc({})
    } else {
      const checkedMap = {}
      this._allIds().forEach((id) => (checkedMap[id] = true))
      this._recalc(checkedMap)
    }
  },

  // 前去结算：选中账单建 partial 轮次 → 进按人结算明细页（轮次模式）
  async onPreview() {
    const txIds = Object.keys(this.data.checkedMap)
    if (txIds.length === 0) {
      wx.showToast({ title: '请至少选择一笔账单', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '生成结算...', mask: true })
    try {
      const res = await api.settle({ bookId: this.data.bookId, type: 'partial', txIds })
      wx.hideLoading()
      const roundId = res && res.round && res.round.id
      if (!roundId) {
        this.setData({ submitting: false })
        wx.showToast({ title: '结算创建异常，请重试', icon: 'none' })
        return
      }
      // redirectTo：结算轮次已建，选账单页无需保留在栈里
      wx.redirectTo({
        url: `/pages/settle-detail/settle-detail?bookId=${this.data.bookId}&roundId=${roundId}`,
      })
      this.setData({ submitting: false })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '结算失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },
})
