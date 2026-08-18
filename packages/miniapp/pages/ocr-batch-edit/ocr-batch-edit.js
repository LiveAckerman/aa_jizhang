const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    bookId: '',
    myUserId: '',
    members: [],
    rates: [{ code: 'CNY', name: '人民币', symbol: '¥', rate: 1, label: '人民币 (CNY)' }],

    ocrImageUrl: '',
    records: [],      // [{ id, checked, initial }]
    current: 0,       // 当前展示的记录索引
    checkedCount: 0,
    ready: false,
    submitting: false,
  },

  onLoad(query) {
    const myUserId = (app.globalData.user || {}).id || ''
    this.setData({ bookId: query.bookId || '', myUserId })
    wx.setNavigationBarTitle({ title: '票据识别结果' })

    // 通过 eventChannel 接收上一页的 OCR 结果
    const ch = this.getOpenerEventChannel && this.getOpenerEventChannel()
    if (ch && ch.on) {
      ch.on('ocrResult', (data) => this.applyOcr(data))
    }

    // 并行加载成员 + 汇率
    Promise.all([this.loadMembers(), this.loadRates()]).finally(() => {
      this.setData({ ready: true })
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

  // 把 OCR 结果转成多条待编辑记录
  applyOcr(data) {
    const imageUrl = data.imageUrl || ''
    const list = (data.records || []).map((r, i) => ({
      id: 'rec_' + i,
      checked: true,
      initial: {
        type: 'shared',
        amount: (r.amount || 0) / 100,          // 分 → 元
        category: 'other',                       // OCR 默认归到「其他」
        note: r.note || r.merchant || '',        // 识别文字作备注
        images: imageUrl ? [imageUrl] : [],       // 共用上传的原图
        spentAt: r.spentAt || new Date().toISOString(),
      },
    }))
    this.setData({
      ocrImageUrl: imageUrl,
      records: list,
      current: 0,
      checkedCount: list.length,
    })
  },

  // 切换到某条
  onSwitchTo(e) {
    this.setData({ current: Number(e.currentTarget.dataset.index) })
  },
  onPrev() {
    if (this.data.current > 0) this.setData({ current: this.data.current - 1 })
  },
  onNext() {
    if (this.data.current < this.data.records.length - 1) {
      this.setData({ current: this.data.current + 1 })
    }
  },

  // 勾选/取消当前条
  onToggleCheck(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const records = this.data.records.slice()
    records[idx] = { ...records[idx], checked: !records[idx].checked }
    this.setData({ records, checkedCount: records.filter((r) => r.checked).length })
  },

  // 删除当前条
  onDelete(e) {
    const idx = Number(e.currentTarget.dataset.index)
    wx.showModal({
      title: '删除此条', content: '确定移除这条识别记录吗？', confirmColor: '#fa9583',
      success: (res) => {
        if (!res.confirm) return
        const records = this.data.records.slice()
        records.splice(idx, 1)
        if (records.length === 0) {
          wx.showToast({ title: '已全部移除', icon: 'none' })
          this.setData({ records: [], current: 0, checkedCount: 0 })
          return
        }
        const current = Math.min(this.data.current, records.length - 1)
        this.setData({ records, current, checkedCount: records.filter((r) => r.checked).length })
      },
    })
  },

  // 确认入库：逐条 buildPayload → 创建
  async onSubmit() {
    if (this.data.submitting) return
    const checkedIdx = this.data.records
      .map((r, i) => (r.checked ? i : -1))
      .filter((i) => i >= 0)
    if (checkedIdx.length === 0) {
      wx.showToast({ title: '请至少勾选一条', icon: 'none' })
      return
    }

    // 收集并校验每条 payload
    const payloads = []
    for (const i of checkedIdx) {
      const form = this.selectComponent('#form_' + i)
      if (!form) continue
      const res = form.buildPayload(this.data.bookId)
      if (!res.ok) {
        this.setData({ current: i }) // 跳到出错那条
        wx.showToast({ title: `第 ${i + 1} 条：${res.message}`, icon: 'none' })
        return
      }
      payloads.push(res.payload)
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '入库中...', mask: true })
    let ok = 0
    const errors = []
    for (const p of payloads) {
      try {
        await api.createTransaction(p)
        ok += 1
      } catch (e) {
        errors.push((e && e.message) || '创建失败')
      }
    }
    wx.hideLoading()

    if (ok === 0) {
      this.setData({ submitting: false })
      wx.showToast({ title: errors[0] || '入库失败', icon: 'none' })
      return
    }
    wx.showToast({ title: `已入库 ${ok} 条`, icon: 'success' })
    setTimeout(() => wx.navigateBack(), 800)
  },
})
