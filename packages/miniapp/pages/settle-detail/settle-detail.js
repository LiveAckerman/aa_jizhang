const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP } = require('../../constants/ledger')

Page({
  data: {
    bookId: '',
    roundId: '',             // 轮次模式：只算该轮账单；空=全部账单模式
    tab: 'all',              // all=全部 / receive=待收款 / pay=待支付
    me: null,              // { userId, nickname, avatar }
    receivables: [],       // 待收款列表（未结清）
    payables: [],          // 待支付列表（未结清）
    settledList: [],       // 已结清对（可撤回）
    expandedMap: {},       // otherUserId -> true 展开明细
    sectionOrder: ['pay', 'receive'], // 全部 tab 下两 section 顺序（按有无数据动态排）
    loading: true,
    submitting: false,
  },

  onLoad(query) {
    const tab = query.tab === 'pay' ? 'pay' : query.tab === 'receive' ? 'receive' : 'all'
    const titleMap = { all: '结算明细', receive: '待收款', pay: '待支付' }
    const roundId = query.roundId || ''
    this.setData({ bookId: query.bookId || '', roundId, tab })
    wx.setNavigationBarTitle({ title: roundId ? '轮次结算' : titleMap[tab] })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    if (!this.data.me) this.setData({ loading: true })
    try {
      const data = await api.settleByPerson(this.data.bookId, this.data.roundId || undefined)
      const payables = this.decorateList(data.payables || [])
      const receivables = this.decorateList(data.receivables || [])
      const settledList = this.decorateList(data.settledList || [])
      this.setData({
        me: data.me || null,
        receivables,
        payables,
        settledList,
        // 全部 tab 下 section 顺序：有数据的排前面；都有则待支付在前
        sectionOrder: payables.length === 0 && receivables.length > 0
          ? ['receive', 'pay']
          : ['pay', 'receive'],
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    }
  },

  // 给列表项加展示字段（金额分转元、明细文案）
  decorateList(list) {
    return list.map((item) => ({
      ...item,
      netAmountText: (item.netAmount / 100).toFixed(2),
      details: (item.details || []).map((d) => {
        const cat = CATEGORY_MAP[d.category] || CATEGORY_MAP.other
        return {
          ...d,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          amountText: (d.amount / 100).toFixed(2),
          dateText: d.spentAt ? String(d.spentAt).slice(0, 10) : '',
          // they_owe：对方欠我；i_owe：我欠对方
          dirText: d.direction === 'they_owe' ? '对方应付' : '我应付',
          isTheyOwe: d.direction === 'they_owe',
        }
      }),
    }))
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    const titleMap = { all: '结算明细', receive: '待收款', pay: '待支付' }
    this.setData({ tab })
    wx.setNavigationBarTitle({ title: titleMap[tab] })
  },

  onToggleExpand(e) {
    const id = e.currentTarget.dataset.id
    const map = { ...this.data.expandedMap }
    if (map[id]) delete map[id]
    else map[id] = true
    this.setData({ expandedMap: map })
  },

  onSettle(e) {
    const { id, name } = e.currentTarget.dataset
    const isReceive = this.data.tab === 'receive'
    const content = isReceive
      ? `确认「${name}」已把钱转给你了吗？结算后这些账单将标记为已处理。`
      : `确认你已把钱转给「${name}」了吗？结算后这些账单将标记为已处理。`
    wx.showModal({
      title: '确认结算',
      content,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) return
        if (this.data.submitting) return
        this.setData({ submitting: true })
        wx.showLoading({ title: '结算中...', mask: true })
        try {
          await api.settlePersonDebt(this.data.bookId, id, this.data.roundId || undefined)
          wx.hideLoading()
          wx.showToast({ title: '已结算', icon: 'success' })
          this.setData({ submitting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '结算失败', icon: 'none' })
          this.setData({ submitting: false })
        }
      },
    })
  },

  // 撤回与某成员的已结算
  onRevert(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '撤回结算',
      content: `确认撤回与「${name}」的结算吗？撤回后将重新计入待结算。`,
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        if (this.data.submitting) return
        this.setData({ submitting: true })
        wx.showLoading({ title: '撤回中...', mask: true })
        try {
          await api.revertPersonDebt(this.data.bookId, id, this.data.roundId || undefined)
          wx.hideLoading()
          wx.showToast({ title: '已撤回', icon: 'success' })
          this.setData({ submitting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '撤回失败', icon: 'none' })
          this.setData({ submitting: false })
        }
      },
    })
  },
})
