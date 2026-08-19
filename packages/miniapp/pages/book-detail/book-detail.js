const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP, shareImageForScene } = require('../../constants/ledger')
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
    allTxs: [],       // 原始账单列表（未过滤）
    groups: [],       // 按日期分组的流水（已按 filter 过滤）
    txFilter: 'all',  // 账单筛选：all / shared(公账) / private(私账)
    filterStat: { count: 0, amountText: '0.00' }, // 当前筛选下的统计
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
        allTxs: txs || [],
        loading: false,
      })
      this.applyTxFilter()
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  // 切换账单筛选 tab：全部 / 公账 / 私账
  onPickTxFilter(e) {
    const val = e.currentTarget.dataset.val
    if (val === this.data.txFilter) return
    this.setData({ txFilter: val })
    this.applyTxFilter()
  },

  // 按当前 txFilter 过滤账单，重算分组与统计
  applyTxFilter() {
    const filter = this.data.txFilter
    const list = (this.data.allTxs || []).filter((t) => {
      if (filter === 'shared') return t.type !== 'private'
      if (filter === 'private') return t.type === 'private'
      return true
    })
    // 统计：当前筛选下的笔数与总额
    const totalCent = list.reduce((sum, t) => sum + (t.amount || 0), 0)
    this.setData({
      groups: this.groupByDate(list),
      filterStat: {
        count: list.length,
        amountText: (totalCent / 100).toFixed(2),
      },
    })
  },

  // 把流水按日期分组，附带展示字段
  groupByDate(txs) {
    const memberMap = {}
    ;(this.data.members || []).forEach((m) => (memberMap[m.userId] = m.nickname))
    const map = {}
    const myUserId = this.data.myUserId
    txs.forEach((t) => {
      const d = t.spentAt ? t.spentAt.slice(0, 10) : ''
      if (!map[d]) map[d] = []
      const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.other
      // 计算"我应付"：公账取 splits 中当前用户的份额；私账不显示
      // （列表已按参与人过滤，能看到的公账当前用户必然参与，无需"未参与"标记）
      let myShareText = ''
      if (t.type !== 'private') {
        const mine = (t.splits || []).find((s) => s.userId === myUserId)
        if (mine) myShareText = (mine.amount / 100).toFixed(2)
      }
      map[d].push({
        ...t,
        amountText: (t.amount / 100).toFixed(2),
        categoryName: cat.name,
        categoryIcon: cat.icon,
        payerName: memberMap[t.payerId] || '成员',
        isPrivate: t.type === 'private',
        myShareText,
      })
    })
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: map[date] }))
  },

  onAddTransaction() {
    wx.navigateTo({ url: `/pages/add-transaction/add-transaction?bookId=${this.data.id}` })
  },

  // 自动票据识别：拍照/相册 → 上传识别 → 跳批量编辑页
  onOcrRecognize() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        wx.showLoading({ title: '识别中...', mask: true })
        try {
          const filePath = res.tempFiles[0].tempFilePath
          const result = await api.ocrRecognizeReceipt(filePath, this.data.id)
          wx.hideLoading()
          if (!result.records || result.records.length === 0) {
            wx.showToast({ title: '未识别到账单记录', icon: 'none' })
            return
          }
          wx.navigateTo({
            url: `/pages/ocr-batch-edit/ocr-batch-edit?bookId=${this.data.id}`,
            success: (navRes) => {
              navRes.eventChannel.emit('ocrResult', result)
            },
          })
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '识别失败', icon: 'none' })
        }
      },
    })
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

  onSettlement() {
    wx.navigateTo({
      url: `/pages/settlement/settlement?bookId=${this.data.id}&bookName=${encodeURIComponent(this.data.book.name || '账本')}`
    })
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
    // 优先自定义封面；否则按场景取分享专属图；再兜底 custom
    const imageUrl = this.data.coverUrl || shareImageForScene(book.scene)
    return {
      title: `邀请你加入「${book.name || '账本'}」一起记账`,
      path: `/pages/join/join?code=${code}`,
      imageUrl,
    }
  },

  // 长按成员头像：移除成员（仅owner可操作）
  onLongPressMember(e) {
    const { userid } = e.currentTarget.dataset
    if (!userid) return
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅创建者可移除成员', icon: 'none' })
      return
    }
    if (userid === this.data.myUserId) {
      wx.showToast({ title: '不能移除自己', icon: 'none' })
      return
    }

    const member = this.data.members.find((m) => m.userId === userid)
    if (!member) return

    wx.showActionSheet({
      itemList: ['查看信息', '移除成员'],
      itemColor: '#2f4159',
      success: (res) => {
        if (res.tapIndex === 1) {
          this.confirmRemoveMember(member)
        } else if (res.tapIndex === 0) {
          wx.showToast({ title: '功能开发中', icon: 'none' })
        }
      },
    })
  },

  // 确认移除成员
  confirmRemoveMember(member) {
    wx.showModal({
      title: '移除成员',
      content: `确定将「${member.nickname}」移出账本吗？该成员的账单记录将保留。`,
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.removeMember(this.data.id, member.userId)
          wx.showToast({ title: '已移除', icon: 'success' })
          setTimeout(() => this.loadAll(), 600)
        } catch (e) {
          wx.showToast({
            title: (e && e.message) || '操作失败',
            icon: 'none',
          })
        }
      },
    })
  },
})
