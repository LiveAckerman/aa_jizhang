const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    bookId: '',
    bookName: '',
    members: [],
    memberMap: {}, // userId -> {nickname, avatar}

    balances: [], // 净收支列表
    transferPlans: [], // 最优转账方案
    pendingSettlements: [], // 待结算记录
    completedList: [], // 已完成（已平账）结算记录

    loading: true,
    calculating: false,
  },

  onLoad(query) {
    // 跳转时 bookName 经过 encodeURIComponent 编码，这里需解码还原中文
    let bookName = '账本'
    try {
      bookName = decodeURIComponent(query.bookName || '') || '账本'
    } catch (e) {
      bookName = query.bookName || '账本'
    }
    this.setData({
      bookId: query.bookId || '',
      bookName,
    })
    wx.setNavigationBarTitle({ title: `${bookName} - 结算` })
    this.loadData()
  },

  onShow() {
    // 从其他页面返回时刷新
    if (this.data.bookId && !this.data.loading) {
      this.loadData()
    }
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      // 并行拉取账本详情和结算方案
      const [book, settlement] = await Promise.all([
        api.bookDetail(this.data.bookId),
        api.calculateSettlement(this.data.bookId),
      ])

      // 构建成员映射
      const memberMap = {}
      ;(book.members || []).forEach((m) => {
        memberMap[m.userId] = {
          nickname: m.nickname || '成员',
          avatar: m.avatar || '',
        }
      })

      // 原始净收支映射（未扣除结算），用于「已平账」时仍显示平账前金额
      const rawMap = {}
      ;(settlement.rawBalances || []).forEach((b) => {
        rawMap[b.userId] = b.balance
      })

      // 处理净收支（分转元）
      // settled：当前净额已为 0，但原始金额非 0 → 说明该成员已平账
      const balances = (settlement.balances || []).map((b) => {
        const raw = rawMap[b.userId] != null ? rawMap[b.userId] : b.balance
        const settled = b.balance === 0 && raw !== 0
        // 已平账显示原始金额，否则显示当前净额
        const shown = settled ? raw : b.balance
        return {
          userId: b.userId,
          nickname: memberMap[b.userId]?.nickname || '成员',
          avatar: memberMap[b.userId]?.avatar || '',
          balance: b.balance,
          balanceText: (Math.abs(shown) / 100).toFixed(2),
          isPositive: shown > 0,
          isNegative: shown < 0,
          settled, // 已平账标识
        }
      })

      // 处理转账方案（分转元）
      const transferPlans = (settlement.transferPlans || []).map((plan) => ({
        fromUserId: plan.fromUserId,
        toUserId: plan.toUserId,
        amount: plan.amount,
        amountText: (plan.amount / 100).toFixed(2),
        fromNickname: memberMap[plan.fromUserId]?.nickname || '成员',
        toNickname: memberMap[plan.toUserId]?.nickname || '成员',
        fromAvatar: memberMap[plan.fromUserId]?.avatar || '',
        toAvatar: memberMap[plan.toUserId]?.avatar || '',
      }))

      // 已完成结算记录（已平账明细，支持撤回单条）
      const completedList = (settlement.completedSettlements || []).map((s) => ({
        id: s.id,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: s.amount,
        amountText: (s.amount / 100).toFixed(2),
        fromNickname: memberMap[s.fromUserId]?.nickname || '成员',
        toNickname: memberMap[s.toUserId]?.nickname || '成员',
        fromAvatar: memberMap[s.fromUserId]?.avatar || '',
        toAvatar: memberMap[s.toUserId]?.avatar || '',
      }))

      this.setData({
        members: book.members || [],
        memberMap,
        balances,
        transferPlans,
        completedList,
        pendingSettlements: settlement.pendingSettlements || [],
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 标记某笔转账为已完成
  onMarkComplete(e) {
    const { from, to, amount } = e.currentTarget.dataset
    const fromName = this.data.memberMap[from]?.nickname || '成员'
    const toName = this.data.memberMap[to]?.nickname || '成员'
    const amountYuan = (amount / 100).toFixed(2)

    wx.showModal({
      title: '确认已转账',
      content: `确认「${fromName}」已向「${toName}」转账 ¥${amountYuan} 吗？`,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '保存中...', mask: true })
          // 创建结算记录
          const settlement = await api.createSettlement({
            bookId: this.data.bookId,
            fromUserId: from,
            toUserId: to,
            amount: amount,
          })
          // 立即标记为已完成
          await api.completeSettlement(settlement.id)
          wx.hideLoading()
          wx.showToast({ title: '已标记', icon: 'success' })
          setTimeout(() => this.loadData(), 600)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
        }
      },
    })
  },

  // 全部完成（所有转账都已完成）
  onCompleteAll() {
    if (this.data.transferPlans.length === 0) {
      wx.showToast({ title: '已结清', icon: 'none' })
      return
    }

    wx.showModal({
      title: '全部结清',
      content: `确认所有转账都已完成吗？共 ${this.data.transferPlans.length} 笔转账。`,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '保存中...', mask: true })
          // 使用批量API，原子性创建并完成所有结算
          const settlements = this.data.transferPlans.map((plan) => ({
            fromUserId: plan.fromUserId,
            toUserId: plan.toUserId,
            amount: plan.amount,
          }))
          await api.batchCreateSettlement({
            bookId: this.data.bookId,
            settlements,
          })
          wx.hideLoading()
          wx.showToast({ title: '已全部标记', icon: 'success' })
          setTimeout(() => this.loadData(), 600)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
        }
      },
    })
  },

  // 撤回单条已平账记录
  onRevertOne(e) {
    const { id, from, to, amount } = e.currentTarget.dataset
    const fromName = this.data.memberMap[from]?.nickname || '成员'
    const toName = this.data.memberMap[to]?.nickname || '成员'
    const amountYuan = (amount / 100).toFixed(2)

    wx.showModal({
      title: '撤回结算',
      content: `确认撤回「${fromName}」向「${toName}」的 ¥${amountYuan} 结算吗？撤回后将重新计入待结算。`,
      confirmText: '撤回',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '撤回中...', mask: true })
          await api.revertSettlement(id)
          wx.hideLoading()
          wx.showToast({ title: '已撤回', icon: 'success' })
          setTimeout(() => this.loadData(), 600)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '撤回失败', icon: 'none' })
        }
      },
    })
  },

  // 撤回某成员相关的全部已平账
  onRevertMember(e) {
    const { id } = e.currentTarget.dataset
    const name = this.data.memberMap[id]?.nickname || '成员'
    wx.showModal({
      title: '撤回结算',
      content: `确认撤回与「${name}」相关的全部已平账吗？`,
      confirmText: '撤回',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '撤回中...', mask: true })
          await api.revertSettlementByUser(this.data.bookId, id)
          wx.hideLoading()
          wx.showToast({ title: '已撤回', icon: 'success' })
          setTimeout(() => this.loadData(), 600)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '撤回失败', icon: 'none' })
        }
      },
    })
  },

  // 撤回全部已平账
  onRevertAll() {
    if (this.data.completedList.length === 0) {
      wx.showToast({ title: '没有可撤回的结算', icon: 'none' })
      return
    }
    wx.showModal({
      title: '撤回全部结算',
      content: `确认撤回全部 ${this.data.completedList.length} 笔已平账吗？撤回后将全部重新计入待结算。`,
      confirmText: '全部撤回',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '撤回中...', mask: true })
          await api.revertSettlementByUser(this.data.bookId, '')
          wx.hideLoading()
          wx.showToast({ title: '已全部撤回', icon: 'success' })
          setTimeout(() => this.loadData(), 600)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '撤回失败', icon: 'none' })
        }
      },
    })
  },
})
