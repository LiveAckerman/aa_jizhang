const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    bookId: '',
    id: '',
    isEdit: false,
    myUserId: '',

    members: [],
    rates: [{ code: 'CNY', name: '人民币', symbol: '¥', rate: 1, label: '人民币 (CNY)' }],
    initial: null,      // 传给 transaction-form 的初始值
    formReady: false,   // 数据就绪后再渲染表单（避免组件用默认值初始化后被覆盖）

    saving: false,
    initLoading: true,
    readonly: false,    // 非创建者进入编辑页：只读，仅可查看
  },

  onLoad(query) {
    const myUserId = (app.globalData.user || {}).id || ''
    this.setData({
      bookId: query.bookId,
      id: query.id || '',
      isEdit: !!query.id,
      myUserId,
    })
    wx.setNavigationBarTitle({ title: query.id ? '编辑账单' : '记一笔' })

    const tasks = [this.loadRates(), this.loadMembers()]
    if (query.id) tasks.push(this.loadTransaction(query.id))
    Promise.all(tasks).finally(() => {
      this.setData({ initLoading: false, formReady: true })
    })
  },

  async loadRates() {
    try {
      const res = await api.exchangeRates()
      if (res && res.rates && res.rates.length) {
        this.setData({ rates: res.rates.map((r) => ({ ...r, label: `${r.name} (${r.code})` })) })
      }
    } catch (e) {}
  },

  async loadMembers() {
    try {
      const book = await api.bookDetail(this.data.bookId)
      this.setData({ members: book.members || [] })
    } catch (e) {}
  },

  async loadTransaction(id) {
    try {
      const tx = await api.transactionDetail(id)
      const currency = tx.currency || 'CNY'
      const displayAmount =
        currency === 'CNY' || !tx.originalAmount ? tx.amount / 100 : tx.originalAmount / 100
      // 只读模式：非记录人，或账单已进入结算轮次（结算中/已结算，需先撤销结算才能改）
      const notMine = !!tx.creatorId && tx.creatorId !== this.data.myUserId
      const inRound = !!tx.settledRoundId
      const readonly = notMine || inRound
      if (readonly) {
        this.setData({ readonly: true, readonlyReason: inRound ? 'settled' : 'notMine' })
        wx.setNavigationBarTitle({ title: '账单详情' })
      }
      this.setData({
        initial: {
          id: tx.id,   // 查重排除自身，避免编辑态把账单自己算成重复
          type: tx.type,
          amount: displayAmount,
          category: tx.category,
          note: tx.note,
          splitMethod: tx.splitMethod || 'average',
          paymentMethod: tx.paymentMethod || 'wechat',
          payerId: tx.payerId,
          images: tx.images || [],
          participantIds: (tx.splits || []).map((s) => s.userId),
          // 回填每人分账明细（指定金额/比例/份数需要），供表单恢复非平分方式
          splits: (tx.splits || []).map((s) => ({ userId: s.userId, amount: s.amount, weight: s.weight })),
          location: tx.locationName
            ? { name: tx.locationName, address: tx.locationAddress, latitude: tx.latitude, longitude: tx.longitude }
            : null,
          spentAt: tx.spentAt,
          currency,
          // 记账时快照汇率：编辑时若不改币种，沿用它，避免用当日汇率重算导致 CNY 金额漂移
          exchangeRate: tx.exchangeRate != null ? Number(tx.exchangeRate) : null,
        },
      })
    } catch (e) {}
  },

  getForm() {
    return this.selectComponent('#txForm')
  },

  // 只读遮罩层：吞掉点击，阻止穿透到表单
  noop() {},

  async onSave() {
    const form = this.getForm()
    if (!form) return
    const res = form.buildPayload(this.data.bookId)
    if (!res.ok) {
      wx.showToast({ title: res.message || '请检查输入', icon: 'none' })
      return
    }
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      if (this.data.isEdit) await api.updateTransaction(this.data.id, res.payload)
      else await api.createTransaction(res.payload)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
      this.setData({ saving: false })
    }
  },

  onOpenLogs() {
    if (!this.data.id) return
    wx.navigateTo({ url: `/packageA/pages/transaction-logs/transaction-logs?id=${this.data.id}` })
  },

  onDelete() {
    wx.showModal({
      title: '删除账单',
      content: '确定删除这笔账单吗？',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.deleteTransaction(this.data.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        } catch (e) {}
      },
    })
  },
})
