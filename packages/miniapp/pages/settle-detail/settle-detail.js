const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP } = require('../../constants/ledger')

Page({
  data: {
    bookId: '',
    tab: 'receive',        // receive=待收款 / pay=待支付
    me: null,              // { userId, nickname, avatar }
    receivables: [],       // 待收款列表
    payables: [],          // 待支付列表
    expandedMap: {},       // otherUserId -> true 展开明细
    loading: true,
    submitting: false,
  },

  onLoad(query) {
    const tab = query.tab === 'pay' ? 'pay' : 'receive'
    this.setData({ bookId: query.bookId || '', tab })
    wx.setNavigationBarTitle({ title: tab === 'pay' ? '待支付' : '待收款' })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    if (!this.data.me) this.setData({ loading: true })
    try {
      const data = await api.settleByPerson(this.data.bookId)
      this.setData({
        me: data.me || null,
        receivables: this.decorateList(data.receivables || []),
        payables: this.decorateList(data.payables || []),
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
    this.setData({ tab })
    wx.setNavigationBarTitle({ title: tab === 'pay' ? '待支付' : '待收款' })
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
          await api.settlePersonDebt(this.data.bookId, id)
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
})
