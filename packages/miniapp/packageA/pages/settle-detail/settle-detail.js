const app = getApp()
const api = require('../../../utils/api')
const { CATEGORY_MAP, COLLECTION_REMINDER_IMAGE } = require('../../../constants/ledger')

Page({
  data: {
    bookId: '',
    roundId: '',             // 轮次模式：只算该轮账单；空=全部账单模式
    tab: 'all',              // all=全部 / receive=待收款 / pay=待支付 / settled=已结算
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
    const validTabs = ['all', 'pay', 'receive', 'settled']
    const tab = validTabs.includes(query.tab) ? query.tab : 'all'
    const titleMap = { all: '结算明细', receive: '待收款', pay: '待支付', settled: '已结算' }
    const roundId = query.roundId || ''
    this.setData({ bookId: query.bookId || '', roundId, tab })
    wx.setNavigationBarTitle({ title: roundId ? '轮次结算' : titleMap[tab] })
    // 开启转发能力（催收「提醒 TA」按钮走 open-type=share）
    if (wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
    }
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
          categorySvg: cat.svgIcon || '',
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
    const titleMap = { all: '结算明细', receive: '待收款', pay: '待支付', settled: '已结算' }
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
    // 根据数据源判断是待收款还是待支付,而不是靠 tab(全部 tab 下点待收款区域 tab 是 'all')
    const isReceive = this.data.receivables.some((item) => item.otherUserId === id)
    const content = isReceive
      ? `确认已收到「${name}」的转账了吗？结算后这些账单将标记为已处理。`
      : `确认你已把钱转给「${name}」了吗？结算后这些账单将标记为已处理。`
    wx.showModal({
      title: '确认结算',
      content,
      confirmColor: '#4097a9',
      success: async (res) => {
        if (!res.confirm) return
        // 防重复提交：用实例变量而非 data，避免 setData 异步导致的竞态条件
        if (this._submitting) return
        this._submitting = true
        this.setData({ submitting: true })
        wx.showLoading({ title: '结算中...', mask: true })
        try {
          await api.settlePersonDebt(this.data.bookId, id, this.data.roundId || undefined)
          wx.hideLoading()
          wx.showToast({ title: '已结算', icon: 'success' })
          this._submitting = false
          this.setData({ submitting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '结算失败', icon: 'none' })
          this._submitting = false
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
        // 防重复提交：用实例变量而非 data，避免 setData 异步导致的竞态条件
        if (this._submitting) return
        this._submitting = true
        this.setData({ submitting: true })
        wx.showLoading({ title: '撤回中...', mask: true })
        try {
          await api.revertPersonDebt(this.data.bookId, id, this.data.roundId || undefined)
          wx.hideLoading()
          wx.showToast({ title: '已撤回', icon: 'success' })
          this._submitting = false
          this.setData({ submitting: false })
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '撤回失败', icon: 'none' })
          this._submitting = false
          this.setData({ submitting: false })
        }
      },
    })
  },

  // 催收提醒：点「提醒 TA」按钮时存当前催收对象（兜底用）
  onRemind(e) {
    this._remindTarget = e.currentTarget.dataset
  },

  // 分享给微信好友：催收提醒（点「提醒 TA」按钮触发）
  onShareAppMessage(res) {
    // button 触发（催收）：从 target.dataset 读待收款对象
    if (res.from === 'button' && res.target && res.target.dataset) {
      const { name, amount } = res.target.dataset
      return {
        title: `${name || 'TA'}，记得转 ¥${amount || '?'} 给我哦~ 💰`,
        path: `/packageA/pages/settle-detail/settle-detail?bookId=${this.data.bookId}&tab=pay`,
        imageUrl: COLLECTION_REMINDER_IMAGE,
      }
    }
    // 右上角菜单触发（或兜底）：用上次记录的催收对象，或通用文案
    const target = this._remindTarget || {}
    const title = target.name
      ? `${target.name}，记得转 ¥${target.amount || '?'} 给我哦~ 💰`
      : '查看结算详情'
    return {
      title,
      path: `/packageA/pages/settle-detail/settle-detail?bookId=${this.data.bookId}&tab=pay`,
      imageUrl: COLLECTION_REMINDER_IMAGE,
    }
  },
})
