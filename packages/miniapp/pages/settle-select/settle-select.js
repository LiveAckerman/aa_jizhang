const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP } = require('../../constants/ledger')

Page({
  data: {
    bookId: '',
    bookName: '账本',
    myUserId: '',
    memberMap: {},        // userId -> nickname
    groups: [],           // 按日期分组的未结算公账
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

  async loadData() {
    this.setData({ loading: true })
    try {
      const [book, txs] = await Promise.all([
        api.bookDetail(this.data.bookId),
        api.listTransactions(this.data.bookId),
      ])
      const memberMap = {}
      ;(book.members || []).forEach((m) => (memberMap[m.userId] = m.nickname))
      // 只列未结算的公账
      const list = (txs || []).filter(
        (t) => t.type !== 'private' && !t.settledRoundId,
      )
      this.setData({
        memberMap,
        groups: this.groupByDate(list),
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  groupByDate(txs) {
    const map = {}
    txs.forEach((t) => {
      const d = t.spentAt ? t.spentAt.slice(0, 10) : ''
      if (!map[d]) map[d] = []
      const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.other
      map[d].push({
        id: t.id,
        amount: t.amount,
        amountText: (t.amount / 100).toFixed(2),
        categoryName: cat.name,
        categoryIcon: cat.icon,
        note: t.note || (this.data.memberMap[t.payerId] || '成员') + ' 付款',
      })
    })
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: map[date] }))
  },

  // 收集所有账单 id（扁平）
  _allIds() {
    const ids = []
    this.data.groups.forEach((g) => g.items.forEach((it) => ids.push(it.id)))
    return ids
  },

  // 计算选中数量与金额
  _recalc(checkedMap) {
    let count = 0
    let amount = 0
    this.data.groups.forEach((g) =>
      g.items.forEach((it) => {
        if (checkedMap[it.id]) {
          count += 1
          amount += it.amount
        }
      }),
    )
    const total = this._allIds().length
    this.setData({
      checkedMap,
      checkedCount: count,
      checkedAmountText: (amount / 100).toFixed(2),
      allChecked: total > 0 && count === total,
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

  // 预览结算：拿勾选的账单算方案，跳结算页确认
  async onPreview() {
    const txIds = Object.keys(this.data.checkedMap)
    if (txIds.length === 0) {
      wx.showToast({ title: '请至少选择一笔账单', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    wx.showLoading({ title: '计算中...', mask: true })
    try {
      const preview = await api.previewPartialSettlement(this.data.bookId, txIds)
      wx.hideLoading()
      // 结算页用 mode=partial，带上 txIds（经 storage 传，避免 URL 过长）
      wx.setStorageSync('partialSettleData', { txIds, preview })
      wx.navigateTo({
        url: `/pages/settlement/settlement?bookId=${this.data.bookId}&bookName=${encodeURIComponent(this.data.bookName)}&mode=partial`,
      })
      this.setData({ submitting: false })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '计算失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },
})
