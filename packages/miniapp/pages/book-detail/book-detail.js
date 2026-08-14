const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP } = require('../../constants/ledger')
const { handleBookAction } = require('../../utils/book-actions')

Page({
  data: {
    id: '',
    book: null,
    coverUrl: '',
    members: [],
    isOwner: false,
    myUserId: '',
    summary: { sharedTotal: 0, myShared: 0, myPrivate: 0, myTotal: 0 },
    summaryText: { sharedTotal: '0.00', myShared: '0.00', myPrivate: '0.00', myTotal: '0.00' },
    groups: [], // 按日期分组的流水
    loading: true,
  },

  onLoad(query) {
    this.setData({ id: query.id, myUserId: (app.globalData.user || {}).id || '' })
    // 开启右上角转发菜单
    if (wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
    }
  },

  onShow() {
    if (this.data.id) this.loadAll()
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh())
  },

  async loadAll() {
    // 首次进入没数据 时展示骨架；已经有数据（从子页返回）静默刷新
    if (!this.data.book) {
      this.setData({ loading: true })
    }
    try {
      const [book, txs, summary] = await Promise.all([
        api.bookDetail(this.data.id),
        api.listTransactions(this.data.id),
        api.transactionSummary(this.data.id),
      ])
      const myUserId = this.data.myUserId
      wx.setNavigationBarTitle({ title: book.name })
      this.setData({
        book,
        coverUrl: book.coverUrl,
        members: book.members || [],
        isOwner: book.ownerId === myUserId,
        summary,
        summaryText: {
          sharedTotal: (summary.sharedTotal / 100).toFixed(2),
          myShared: (summary.myShared / 100).toFixed(2),
          myPrivate: (summary.myPrivate / 100).toFixed(2),
          myTotal: (summary.myTotal / 100).toFixed(2),
        },
        groups: this.groupByDate(txs || []),
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  // 把流水按日期分组，附带展示字段
  groupByDate(txs) {
    const memberMap = {}
    ;(this.data.members || []).forEach((m) => (memberMap[m.userId] = m.nickname))
    const map = {}
    txs.forEach((t) => {
      const d = t.spentAt ? t.spentAt.slice(0, 10) : ''
      if (!map[d]) map[d] = []
      const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.other
      map[d].push({
        ...t,
        amountText: (t.amount / 100).toFixed(2),
        categoryName: cat.name,
        categoryIcon: cat.icon,
        payerName: memberMap[t.payerId] || '成员',
        isPrivate: t.type === 'private',
      })
    })
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: map[date] }))
  },

  onAddTransaction() {
    wx.navigateTo({ url: `/pages/add-transaction/add-transaction?bookId=${this.data.id}` })
  },

  onTapTransaction(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/add-transaction/add-transaction?bookId=${this.data.id}&id=${id}` })
  },

  onInvite() {
    wx.navigateTo({ url: `/pages/invite/invite?id=${this.data.id}` })
  },

  onStatistics() {
    wx.switchTab({ url: '/pages/statistics/statistics' })
  },

  // book-menu 组件抛出的操作事件
  onBookAction(e) {
    const detail = e.detail
    handleBookAction(detail, (result) => {
      if (result && result.removed) {
        // 删除 / 退出：直接返回上一页
        setTimeout(() => wx.navigateBack(), 300)
      } else {
        this.loadAll()
      }
    })
  },

  // 转发给微信好友：邀请一起记账
  onShareAppMessage() {
    const book = this.data.book || {}
    const code = book.inviteCode || ''
    return {
      title: `邀请你加入「${book.name || '账本'}」一起记账`,
      path: `/pages/join/join?code=${code}`,
      imageUrl: this.data.coverUrl || '',
    }
  },
})
