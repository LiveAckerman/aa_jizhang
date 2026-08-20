const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    bookId: '',
    bookName: '',
    myUserId: '',
    mode: 'all',          // all=全部结算 / partial=部分结算
    partialTxIds: [],
    memberMap: {},

    // 页面阶段：preview=预览待确认结算 / active=已生成轮次逐笔确认
    stage: 'preview',

    // 预览态数据
    balances: [],
    previewPlans: [],
    txCount: 0,
    totalAmountText: '0.00',

    // 进行态数据（当前轮次）
    activeRoundId: '',
    mineTransfers: [],    // 与我相关的转账（可操作）
    otherTransfers: [],   // 他人之间的转账（只读）
    minePendingCount: 0,  // 我还有几笔待确认

    rounds: [],           // 历史轮次
    loading: true,
    submitting: false,
    acting: false,
  },

  onLoad(query) {
    let bookName = '账本'
    try {
      bookName = decodeURIComponent(query.bookName || '') || '账本'
    } catch (e) {
      bookName = query.bookName || '账本'
    }
    const mode = query.mode === 'partial' ? 'partial' : 'all'
    this.setData({
      bookId: query.bookId || '',
      bookName,
      mode,
      myUserId: (app.globalData.user || {}).id || '',
    })
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
      this.setData({ memberMap })

      // 先查是否有进行中的轮次（存在待确认转账）
      const active = await api.getActiveRound(this.data.bookId)
      if (active && active.id) {
        this.applyActiveRound(active)
      } else {
        await this.loadPreview()
      }

      await this.loadRounds()
      this.setData({ loading: false })
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 预览态：计算本次将结算的方案（还没落库）
  async loadPreview() {
    let plan
    if (this.data.mode === 'partial') {
      const cache = wx.getStorageSync('partialSettleData') || {}
      plan = cache.preview || { balances: [], transferPlans: [], txCount: 0, totalAmount: 0 }
      this.setData({ partialTxIds: cache.txIds || [] })
    } else {
      plan = await api.calculateSettlement(this.data.bookId)
    }
    const mm = this.data.memberMap
    const balances = (plan.balances || []).map((b) => ({
      userId: b.userId,
      nickname: mm[b.userId]?.nickname || '成员',
      avatar: mm[b.userId]?.avatar || '',
      balanceText: (Math.abs(b.balance) / 100).toFixed(2),
      isPositive: b.balance > 0,
      isNegative: b.balance < 0,
    }))
    const previewPlans = (plan.transferPlans || []).map((p) => this.decoratePlan(p, mm))
    this.setData({
      stage: 'preview',
      balances,
      previewPlans,
      txCount: plan.txCount || 0,
      totalAmountText: ((plan.totalAmount || 0) / 100).toFixed(2),
    })
  },

  // 进行态：把当前轮次的转账拆成「与我相关 / 他人之间」
  applyActiveRound(round) {
    const mm = this.data.memberMap
    const me = this.data.myUserId
    const mine = []
    const other = []
    let minePending = 0
    ;(round.settlements || []).forEach((s) => {
      const item = this.decorateTransfer(s, mm, me)
      if (item.isMine) {
        mine.push(item)
        if (!item.confirmed) minePending += 1
      } else {
        other.push(item)
      }
    })
    this.setData({
      stage: 'active',
      activeRoundId: round.id,
      txCount: round.txCount || 0,
      totalAmountText: ((round.totalAmount || 0) / 100).toFixed(2),
      mineTransfers: mine,
      otherTransfers: other,
      minePendingCount: minePending,
    })
  },

  // 预览方案条目装饰
  decoratePlan(p, mm) {
    return {
      fromUserId: p.fromUserId,
      toUserId: p.toUserId,
      amountText: (p.amount / 100).toFixed(2),
      fromNickname: mm[p.fromUserId]?.nickname || '成员',
      toNickname: mm[p.toUserId]?.nickname || '成员',
      fromAvatar: mm[p.fromUserId]?.avatar || '',
      toAvatar: mm[p.toUserId]?.avatar || '',
    }
  },

  // 轮次内转账条目装饰（带 settlementId、isMine、confirmed）
  decorateTransfer(s, mm, me) {
    return {
      id: s.id,
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amountText: (s.amount / 100).toFixed(2),
      fromNickname: mm[s.fromUserId]?.nickname || '成员',
      toNickname: mm[s.toUserId]?.nickname || '成员',
      fromAvatar: mm[s.fromUserId]?.avatar || '',
      toAvatar: mm[s.toUserId]?.avatar || '',
      isMine: s.fromUserId === me || s.toUserId === me,
      confirmed: s.status === 'completed',
    }
  },

  async loadRounds() {
    const roundsRaw = await api.listSettlementRounds(this.data.bookId)
    const mm = this.data.memberMap
    const rounds = (roundsRaw || []).map((r, i) => {
      const settlements = r.settlements || []
      const doneCount = settlements.filter((s) => s.status === 'completed').length
      const allDone = settlements.length > 0 && doneCount === settlements.length
      return {
        id: r.id,
        seq: roundsRaw.length - i,
        typeText: r.type === 'partial' ? '部分结算' : '全部结算',
        txCount: r.txCount,
        totalAmountText: (r.totalAmount / 100).toFixed(2),
        dateText: (r.createdAt || '').slice(0, 10),
        statusText: allDone ? '已完成' : `进行中 ${doneCount}/${settlements.length}`,
        allDone,
        plans: settlements.map((s) => ({
          amountText: (s.amount / 100).toFixed(2),
          fromNickname: mm[s.fromUserId]?.nickname || '成员',
          toNickname: mm[s.toUserId]?.nickname || '成员',
          confirmed: s.status === 'completed',
        })),
      }
    })
    this.setData({ rounds })
  },

  // ===== 预览态：确认结算，生成轮次（转账变 pending）=====
  onConfirmSettle() {
    if (this.data.submitting) return
    if (this.data.txCount === 0) {
      wx.showToast({ title: '没有可结算的账单', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const tip =
      this.data.mode === 'partial'
        ? `确认结算所选 ${this.data.txCount} 笔账单吗？结算后需各成员逐笔确认收款。`
        : `确认结算全部 ${this.data.txCount} 笔未结算账单吗？结算后需各成员逐笔确认收款。`
    wx.showModal({
      title: '确认结算',
      content: tip,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ submitting: false })
          return
        }
        wx.showLoading({ title: '结算中...', mask: true })
        try {
          const payload = { bookId: this.data.bookId, type: this.data.mode }
          if (this.data.mode === 'partial') payload.txIds = this.data.partialTxIds
          await api.settle(payload)
          if (this.data.mode === 'partial') wx.removeStorageSync('partialSettleData')
          wx.hideLoading()
          this.setData({ submitting: false })
          wx.showToast({ title: '已生成结算', icon: 'success' })
          // 留在页面进入逐笔确认态
          this.loadData()
        } catch (e) {
          wx.hideLoading()
          this.setData({ submitting: false })
          wx.showToast({ title: (e && e.message) || '结算失败', icon: 'none' })
        }
      },
      fail: () => this.setData({ submitting: false }),
    })
  },

  // ===== 进行态：确认单笔 =====
  onConfirmTransfer(e) {
    if (this.data.acting) return
    const { id } = e.currentTarget.dataset
    this.setData({ acting: true })
    wx.showModal({
      title: '确认收款',
      content: '确认这笔转账已完成吗？',
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ acting: false })
          return
        }
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await api.confirmTransfer(id)
          wx.hideLoading()
          this.setData({ acting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          this.setData({ acting: false })
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      },
      fail: () => this.setData({ acting: false }),
    })
  },

  // 进行态：撤销单笔已确认
  onRevertTransfer(e) {
    if (this.data.acting) return
    const { id } = e.currentTarget.dataset
    this.setData({ acting: true })
    wx.showModal({
      title: '撤销确认',
      content: '撤销这笔转账的确认状态？',
      confirmText: '撤销',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ acting: false })
          return
        }
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await api.revertTransfer(id)
          wx.hideLoading()
          this.setData({ acting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          this.setData({ acting: false })
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      },
      fail: () => this.setData({ acting: false }),
    })
  },

  // 进行态：一键确认我相关的全部待确认
  onConfirmAllMine() {
    if (this.data.acting) return
    if (this.data.minePendingCount === 0) {
      wx.showToast({ title: '没有待确认的转账', icon: 'none' })
      return
    }
    this.setData({ acting: true })
    wx.showModal({
      title: '全部确认',
      content: `确认与我相关的 ${this.data.minePendingCount} 笔转账都已完成吗？`,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ acting: false })
          return
        }
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await api.confirmMyTransfers(this.data.activeRoundId)
          wx.hideLoading()
          this.setData({ acting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          this.setData({ acting: false })
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      },
      fail: () => this.setData({ acting: false }),
    })
  },

  // 撤销整轮
  onRevertRound(e) {
    if (this.data.acting) return
    const { id, seq } = e.currentTarget.dataset
    this.setData({ acting: true })
    wx.showModal({
      title: '撤销结算',
      content: `确认撤销「第 ${seq} 次结算」吗？该轮账单将恢复为未结算。`,
      confirmText: '撤销',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ acting: false })
          return
        }
        wx.showLoading({ title: '撤销中...', mask: true })
        try {
          await api.revertSettlementRound(id)
          wx.hideLoading()
          this.setData({ acting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          this.setData({ acting: false })
          wx.showToast({ title: (err && err.message) || '撤销失败', icon: 'none' })
        }
      },
      fail: () => this.setData({ acting: false }),
    })
  },

  // 完成/返回账本
  onBack() {
    wx.navigateBack()
  },
})
