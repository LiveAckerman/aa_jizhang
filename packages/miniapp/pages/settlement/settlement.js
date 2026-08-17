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

      // 处理净收支（分转元）
      const balances = (settlement.balances || []).map((b) => ({
        userId: b.userId,
        nickname: memberMap[b.userId]?.nickname || '成员',
        avatar: memberMap[b.userId]?.avatar || '',
        balance: b.balance,
        balanceText: (Math.abs(b.balance) / 100).toFixed(2),
        isPositive: b.balance > 0,
        isNegative: b.balance < 0,
      }))

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

      this.setData({
        members: book.members || [],
        memberMap,
        balances,
        transferPlans,
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
          wx.showLoading({ title: '保存中...' })
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
          wx.showLoading({ title: '保存中...' })
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
})
