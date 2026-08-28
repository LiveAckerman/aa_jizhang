const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    bookId: '',
    myUserId: '',
    members: [],
    rates: [{ code: 'CNY', name: '人民币', symbol: '¥', rate: 1, label: '人民币 (CNY)' }],

    ocrImageUrl: '',
    records: [],   // [{ id, initial }] 待处理
    trashed: [],   // [{ id, initial }] 已跳过（垃圾桶，可恢复）
    current: 0,    // 当前展示索引
    ready: false,
    submitting: false,
    showTrash: false, // 垃圾桶抽屉显隐
  },

  onLoad(query) {
    const myUserId = (app.globalData.user || {}).id || ''
    this.setData({ bookId: query.bookId || '', myUserId })
    wx.setNavigationBarTitle({ title: '票据识别结果' })

    const ch = this.getOpenerEventChannel && this.getOpenerEventChannel()
    if (ch && ch.on) ch.on('ocrResult', (data) => this.applyOcr(data))

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

  applyOcr(data) {
    const imageUrl = data.imageUrl || ''
    // 用时间戳生成稳定唯一 id，避免 splice 后下标重排导致 wx:key 组件复用错位
    const now = Date.now()
    const list = (data.records || []).map((r, i) => ({
      id: 'rec_' + now + '_' + i,
      initial: {
        type: 'shared',
        amount: (r.amount || 0) / 100,
        category: r.category || 'other',
        paymentMethod: r.paymentMethod || 'wechat',
        note: r.note || r.merchant || '',
        images: imageUrl ? [imageUrl] : [],   // 自动回填 OCR 原图作为凭证图片
        spentAt: r.spentAt || new Date().toISOString(),
      },
    }))
    this.setData({
      ocrImageUrl: imageUrl,
      records: list,
      trashed: [],   // 重新识别：清空垃圾桶
      current: 0,
      showTrash: false,
    })
  },

  onPrev() {
    if (this.data.current > 0) this.setData({ current: this.data.current - 1 })
  },
  onNext() {
    if (this.data.current < this.data.records.length - 1) {
      this.setData({ current: this.data.current + 1 })
    }
  },

  // 重新上传并 OCR，有未提交记录时加二次确认
  onReupload() {
    const doReupload = () => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        success: async (res) => {
          wx.showLoading({ title: '重新识别中...', mask: true })
          try {
            const result = await api.ocrRecognizeReceipt(res.tempFiles[0].tempFilePath, this.data.bookId)
            wx.hideLoading()
            if (!result.records || result.records.length === 0) {
              wx.showToast({ title: '未识别到支付记录', icon: 'none' })
            } else {
              this.applyOcr(result)
            }
          } catch (e) {
            wx.hideLoading()
            wx.showToast({ title: (e && e.message) || '识别失败', icon: 'none' })
          }
        },
      })
    }

    // 有未提交记录时，二次确认（防止丢失已编辑的内容）
    if (this.data.records.length > 0) {
      wx.showModal({
        title: '重新上传',
        content: `当前还有 ${this.data.records.length} 条记录未提交，重新上传将清空这些记录，确认继续？`,
        confirmText: '继续',
        confirmColor: '#fa9583',
        success: (r) => { if (r.confirm) doReupload() },
      })
    } else {
      doReupload()
    }
  },

  // 预览 OCR 原图
  onPreviewImage() {
    if (!this.data.ocrImageUrl) return
    wx.previewImage({ current: this.data.ocrImageUrl, urls: [this.data.ocrImageUrl] })
  },

  // 提交当条，提交成功后从列表移除
  async onSubmit() {
    if (this.data.submitting) return
    const { records, current, bookId } = this.data
    if (records.length === 0) return

    const form = this.selectComponent('#form_' + records[current].id)
    if (!form) return

    const res = form.buildPayload(bookId)
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    try {
      await api.createTransaction(res.payload)
      wx.hideLoading()

      const newRecords = records.slice()
      newRecords.splice(current, 1)

      if (newRecords.length === 0) {
        // 全部处理完成：直接返回账本，不停留
        wx.navigateBack()
        return
      }

      const newCurrent = Math.min(current, newRecords.length - 1)
      wx.showToast({ title: '已提交', icon: 'success' })
      // total 保持原始总数，让进度显示"已处理/总计"的语义
      this.setData({ records: newRecords, current: newCurrent, submitting: false })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 跳过当前条：移进垃圾桶，自动展示下一条；records 空则直接返回
  onSkipCurrent() {
    const { records, current, trashed } = this.data
    if (records.length === 0) return

    const skipped = records[current]
    const newRecords = records.slice()
    newRecords.splice(current, 1)
    const newTrashed = trashed.concat(skipped)

    if (newRecords.length === 0) {
      // 待处理清空：直接返回账本（跳过的记录随之丢弃）
      wx.navigateBack()
      return
    }

    const newCurrent = Math.min(current, newRecords.length - 1)
    this.setData({ records: newRecords, trashed: newTrashed, current: newCurrent })
  },

  // 打开垃圾桶抽屉（空则不弹）
  onOpenTrash() {
    if (this.data.trashed.length === 0) return
    this.setData({ showTrash: true })
  },

  onCloseTrash() {
    this.setData({ showTrash: false })
  },

  // 从垃圾桶恢复某条：移回待处理末尾，关抽屉并跳到该条
  onRestore(e) {
    const id = e.currentTarget.dataset.id
    const { trashed, records } = this.data
    const idx = trashed.findIndex((r) => r.id === id)
    if (idx === -1) return

    const restored = trashed[idx]
    const newTrashed = trashed.slice()
    newTrashed.splice(idx, 1)
    const newRecords = records.concat(restored)

    this.setData({
      records: newRecords,
      trashed: newTrashed,
      current: newRecords.length - 1, // 跳到恢复的这条
      showTrash: false,
    })
  },

  // 主动返回（缩略图 × / 空态返回）：有未处理记录或垃圾桶非空时二次确认
  onExit() {
    const remaining = this.data.records.length
    const trashedCount = this.data.trashed.length
    if (remaining === 0 && trashedCount === 0) {
      wx.navigateBack()
      return
    }
    const parts = []
    if (remaining > 0) parts.push(`${remaining} 条未处理`)
    if (trashedCount > 0) parts.push(`${trashedCount} 条已跳过`)
    wx.showModal({
      title: '退出识别',
      content: `还有 ${parts.join('、')}，退出后将丢弃，确认退出？`,
      confirmText: '退出',
      confirmColor: '#fa9583',
      success: (r) => { if (r.confirm) wx.navigateBack() },
    })
  },

  // 空态下直接返回
  onBack() {
    wx.navigateBack()
  },

  // 阻止抽屉面板内点击冒泡到遮罩层（避免误关）
  stopPropagation() {},
})
