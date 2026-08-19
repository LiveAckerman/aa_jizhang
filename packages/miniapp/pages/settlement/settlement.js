const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    bookId: '',
    bookName: '',
    mode: 'all',          // all=全部结算 / partial=部分结算
    partialTxIds: [],     // 部分结算的账单 id
    memberMap: {},        // userId -> {nickname, avatar}

    balances: [],         // 本次结算涉及的净收支
    transferPlans: [],    // 本次结算的最优转账方案
    txCount: 0,
    totalAmountText: '0.00',

    rounds: [],           // 已有结算轮次（历史）
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
    const mode = query.mode === 'partial' ? 'partial' : 'all'
    this.setData({ bookId: query.bookId || '', bookName, mode })
    wx.setNavigationBarTitle({ title: `${bookName} - 结算` })
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const book = await api.bookDetail(this.data.bookId)
      const memberMap = {}
      ;(book.members || []).forEach((m) => {
        memberMap[m.userId] = { nickname: m.nickname || '成员', avatar: m.avatar || '' }
      })

      // 本次结算方案：部分结算用 storage 里的预览；全部结算实时算
      let plan
      if (this.data.mode === 'partial') {
        const cache = wx.getStorageSync('partialSettleData') || {}
        plan = cache.preview || { balances: [], transferPlans: [], txCount: 0, totalAmount: 0 }
        this.setData({ partialTxIds: cache.txIds || [] })
      } else {
        plan = await api.calculateSettlement(this.data.bookId)
      }

      const balances = (plan.balances || []).map((b) => ({
        userId: b.userId,
        nickname: memberMap[b.userId]?.nickname || '成员',
        avatar: memberMap[b.userId]?.avatar || '',
        balanceText: (Math.abs(b.balance) / 100).toFixed(2),
        isPositive: b.balance > 0,
        isNegative: b.balance < 0,
      }))

      const transferPlans = (plan.transferPlans || []).map((p) => ({
        fromUserId: p.fromUserId,
        toUserId: p.toUserId,
        amount: p.amount,
        amountText: (p.amount / 100).toFixed(2),
        fromNickname: memberMap[p.fromUserId]?.nickname || '成员',
        toNickname: memberMap[p.toUserId]?.nickname || '成员',
        fromAvatar: memberMap[p.fromUserId]?.avatar || '',
        toAvatar: memberMap[p.toUserId]?.avatar || '',
      }))

      // 历史结算轮次
      const roundsRaw = await api.listSettlementRounds(this.data.bookId)
      const rounds = (roundsRaw || []).map((r, i) => ({
        id: r.id,
        seq: (roundsRaw.length - i), // 最新的序号最大
        typeText: r.type === 'partial' ? '部分结算' : '全部结算',
        txCount: r.txCount,
        totalAmountText: (r.totalAmount / 100).toFixed(2),
        dateText: (r.createdAt || '').slice(0, 10),
        plans: (r.settlements || []).map((s) => ({
          amountText: (s.amount / 100).toFixed(2),
          fromNickname: memberMap[s.fromUserId]?.nickname || '成员',
          toNickname: memberMap[s.toUserId]?.nickname || '成员',
          fromAvatar: memberMap[s.fromUserId]?.avatar || '',
          toAvatar: memberMap[s.toUserId]?.avatar || '',
        })),
      }))

      this.setData({
        memberMap,
        balances,
        transferPlans,
        txCount: plan.txCount || 0,
        totalAmountText: ((plan.totalAmount || 0) / 100).toFixed(2),
        rounds,
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 确认结算：把本次涉及账单标记为已结算，生成一轮
  onConfirmSettle() {
    if (this.data.submitting) return
    if (this.data.transferPlans.length === 0 && this.data.txCount === 0) {
      wx.showToast({ title: '没有可结算的账单', icon: 'none' })
      return
    }
    const tip =
      this.data.mode === 'partial'
        ? `确认结算所选 ${this.data.txCount} 笔账单吗？`
        : `确认结算全部 ${this.data.txCount} 笔未结算账单吗？`

    wx.showModal({
      title: '确认结算',
      content: tip,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ submitting: true })
        wx.showLoading({ title: '结算中...', mask: true })
        try {
          const payload = { bookId: this.data.bookId, type: this.data.mode }
          if (this.data.mode === 'partial') payload.txIds = this.data.partialTxIds
          await api.settle(payload)
          if (this.data.mode === 'partial') wx.removeStorageSync('partialSettleData')
          wx.hideLoading()
          wx.showToast({ title: '结算完成', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 800)
        } catch (e) {
          wx.hideLoading()
          this.setData({ submitting: false })
          wx.showToast({ title: (e && e.message) || '结算失败', icon: 'none' })
        }
      },
    })
  },

  // 撤销某一轮结算
  onRevertRound(e) {
    const { id, seq } = e.currentTarget.dataset
    wx.showModal({
      title: '撤销结算',
      content: `确认撤销「第 ${seq} 次结算」吗？该轮账单将恢复为未结算。`,
      confirmText: '撤销',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '撤销中...', mask: true })
        try {
          await api.revertSettlementRound(id)
          wx.hideLoading()
          wx.showToast({ title: '已撤销', icon: 'success' })
          setTimeout(() => this.loadData(), 600)
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '撤销失败', icon: 'none' })
        }
      },
    })
  },
})
